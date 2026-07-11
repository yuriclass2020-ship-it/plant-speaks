import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dbPath,
  getAppState,
  getUsageCount as getStoredUsageCount,
  incrementUsageCount,
  resetAppState,
  saveAppState,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
const ttsCacheDir = path.join(__dirname, 'data', 'tts-cache');

function loadLocalEnv() {
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const ttsCache = new Map();
const TTS_STYLE_VERSION = 'mini-tts-stable-marin-v2-short';
const plantInfoDraftCache = new Map();
const photoAnalysisCache = new Map();
const PHOTO_ANALYSIS_STYLE_VERSION = 'visible-only-v2';
const DEFAULT_PLANT_INFO_MODEL = 'gpt-4o-mini';
const DEFAULT_PHOTO_ANALYSIS_MODEL = 'gpt-4o-mini';
const DEFAULT_CHAT_ANSWER_MODEL = 'gpt-4o-mini';
const PLANT_INFO_RETRY_COUNT = 2;
const PLANT_INFO_TIMEOUT_MS = 30000;
const PHOTO_ANALYSIS_TIMEOUT_MS = 30000;
const CHAT_ANSWER_TIMEOUT_MS = 18000;

function getTestAccessCodes() {
  const rawCodes = process.env.TEST_ACCESS_CODES || process.env.TEST_ACCESS_CODE || '';

  return rawCodes
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
}

function getRequestAccessCode(req) {
  return String(req.get('x-test-access-code') ?? '').trim();
}

function requireTestAccess(req, res) {
  const expectedCodes = getTestAccessCodes();

  if (expectedCodes.length === 0) return true;

  const actualCode = getRequestAccessCode(req);

  if (expectedCodes.includes(actualCode)) return true;

  res.status(401).json({
    ok: false,
    code: 'TEST_ACCESS_REQUIRED',
    error: '테스트 참여 코드가 필요해요.',
  });

  return false;
}

function getRequestGroupId(req) {
  return getRequestAccessCode(req) || 'default';
}

function parsePositiveIntegerEnv(key, fallback) {
  const value = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getDailyUsageLimits() {
  return {
    draft: parsePositiveIntegerEnv('DAILY_DRAFT_LIMIT', 10),
    photo: parsePositiveIntegerEnv('DAILY_PHOTO_ANALYSIS_LIMIT', 20),
    chat: parsePositiveIntegerEnv('DAILY_CHAT_LIMIT', 30),
    tts: parsePositiveIntegerEnv('DAILY_TTS_LIMIT', 100),
  };
}

function getUsageDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getTestDeadline() {
  const rawDeadline = String(process.env.APP_TEST_UNTIL ?? '').trim();
  if (!rawDeadline) return null;

  const deadline = new Date(rawDeadline);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

function getTestAvailability() {
  const deadline = getTestDeadline();

  if (!deadline) {
    return {
      allowed: true,
      deadline: null,
    };
  }

  return {
    allowed: Date.now() <= deadline.getTime(),
    deadline: deadline.toISOString(),
  };
}

function getUsageCount(kind) {
  return getStoredUsageCount(kind, getUsageDateKey());
}

function incrementUsage(kind) {
  return incrementUsageCount(kind, getUsageDateKey());
}

function getUsageSnapshot() {
  const limits = getDailyUsageLimits();

  return Object.fromEntries(
    Object.entries(limits).map(([kind, limit]) => [
      kind,
      {
        count: getUsageCount(kind),
        limit,
      },
    ])
  );
}

function checkApiGate(kind) {
  const availability = getTestAvailability();

  if (!availability.allowed) {
    return {
      ok: false,
      status: 403,
      code: 'TEST_PERIOD_ENDED',
      message: '오늘 테스트는 끝났어요. 내일 또 만나요.',
      deadline: availability.deadline,
    };
  }

  const limits = getDailyUsageLimits();
  const limit = limits[kind] ?? 0;
  const count = getUsageCount(kind);

  if (limit > 0 && count >= limit) {
    return {
      ok: false,
      status: 429,
      code: 'DAILY_LIMIT_REACHED',
      message: '오늘 AI 사용량을 모두 썼어요. 내일 또 만나요.',
      count,
      limit,
    };
  }

  return {
    ok: true,
    count,
    limit,
  };
}

function sendApiGateResponse(res, gate, fallbackPayload = {}) {
  return res.status(gate.status).json({
    ok: false,
    error: gate.message,
    code: gate.code,
    count: gate.count,
    limit: gate.limit,
    deadline: gate.deadline,
    ...fallbackPayload,
  });
}

const localPlantInfoDrafts = [
  {
    names: ['보리새싹', '보리 싹', '보리', 'barley sprout', 'barley grass'],
    draft: {
      summary:
        '보리새싹은 씨앗에서 싹이 빠르게 올라오고 초록 잎이 자라는 모습을 관찰하기 좋은 식물이에요. 키, 잎 색, 잎 수, 기울기 변화를 매일 비교해 볼 수 있어요.',
      edibleInfo:
        '보리새싹은 보통 어린잎을 먹을 수 있는 식물로 알려져 있어요. 씨앗을 뿌린 뒤 7일에서 10일 정도 지나 잎이 10cm에서 15cm쯤 자라고 초록색이 선명할 때 수확해 먹는 경우가 많아요. 깨끗하게 자란 새싹을 잘라 씻은 뒤 샐러드에 조금 곁들이거나 주스로 갈아 먹는 예가 있어요. 다만 교실에서 먹기 전에는 씨앗과 흙, 물, 위생 상태를 선생님이나 어른이 꼭 먼저 확인해야 해요.',
      flowerInfo:
        '교실에서 짧게 키우는 보리새싹은 보통 꽃보다 새싹과 잎 자람을 관찰해요. 오래 키우면 이삭이 생길 수 있지만 새싹 관찰에서는 드물어요.',
      fruitInfo:
        '보리새싹 활동에서는 열매보다 씨앗에서 싹이 나고 잎이 자라는 과정을 관찰해요. 오래 자라면 이삭과 낟알이 생길 수 있어요.',
      observationPoints:
        '싹이 난 날, 키, 잎 색, 잎 수, 줄기 기울기, 뿌리, 흙 또는 키친타월의 촉촉함',
      caution:
        '먹기 전에는 반드시 선생님이나 어른이 확인해요. 곰팡이가 보이거나 냄새가 이상하거나 흙과 물 위생이 확실하지 않으면 먹지 않아요.',
      growthInfo:
        '보리새싹은 빠르게 자라며 며칠 사이에 키가 달라지는 모습을 볼 수 있어요. 매일 같은 자리에서 사진을 찍고 키를 비교하면 좋아요.',
      careInfo:
        '마르지 않게 촉촉하게 유지하되 물이 고이지 않게 해요. 밝은 곳에 두고 잎이 누렇게 변하거나 쓰러지는지 살펴봐요.',
      lightInfo:
        '싹이 올라온 뒤에는 밝은 빛을 받으면 잎이 초록색으로 변해요. 너무 뜨거운 직사광선은 피하고 밝은 곳에서 관찰해요.',
      environmentInfo:
        '따뜻하고 밝은 실내에서 잘 자라요. 너무 춥거나 물이 부족하면 자람이 느려질 수 있어요.',
      lifecycleInfo:
        '새싹 관찰은 보통 1주에서 2주 정도가 알맞아요. 시간이 지나면 잎이 길어지고 쓰러지거나 누렇게 변할 수 있어요.',
      smellInfo:
        '신선할 때는 풀 냄새가 날 수 있어요. 시큼하거나 곰팡이 냄새가 나면 먹지 않고 선생님에게 알려요.',
      favoriteInfo:
        '따뜻한 실내, 밝은 빛, 촉촉하지만 고이지 않는 물을 좋아해요.',
      dislikeInfo:
        '물이 고이는 것, 너무 마르는 것, 곰팡이가 생기는 환경을 힘들어해요.',
      recommendedWaterIntervalDays: 1,
      recommendedSunGoal: 1,
      careChecklist:
        '매일 촉촉한지 보기, 물이 고였는지 확인하기, 키와 잎 색 비교하기, 곰팡이나 이상한 냄새 확인하기',
      childAnswerHints:
        '먹는 질문에는 7일에서 10일쯤, 10cm에서 15cm 정도 자랐을 때를 안내하되 먹기 전 선생님 확인과 위생 확인을 꼭 말해요.',
    },
  },
  {
    names: ['바질', 'basil'],
    draft: {
      summary:
        '바질은 향이 나는 잎을 관찰하기 좋은 허브 식물이에요. 잎 색, 잎 냄새, 새 잎이 나는 모습을 살펴볼 수 있어요.',
      edibleInfo:
        '바질은 보통 잎을 먹는 허브로 알려져 있어요. 잎을 깨끗이 씻어 샐러드나 토마토 요리에 조금 넣거나 향을 내는 데 쓰는 예가 있어요. 그래도 교실 식물은 먹기 전에 꼭 선생님이나 어른이 종류와 위생 상태를 먼저 확인해야 해요.',
      flowerInfo:
        '바질은 자라면 줄기 끝에 작은 꽃이 필 수 있어요. 꽃이 보이면 잎과 줄기 끝 변화를 함께 관찰해요.',
      fruitInfo:
        '바질은 열매보다 잎과 꽃, 씨앗 변화를 관찰하는 식물로 보는 게 좋아요.',
      observationPoints: '잎 색, 잎 냄새, 새 잎, 줄기 끝, 흙 상태',
      caution: '선생님 확인 전에는 잎을 따거나 먹지 않아요.',
    },
  },
  {
    names: ['민트', '애플민트', '스피어민트', 'mint'],
    draft: {
      summary:
        '민트는 향이 강한 잎과 줄기 변화를 관찰하기 좋은 허브 식물이에요.',
      edibleInfo:
        '민트는 보통 잎을 먹거나 향을 맡는 허브로 알려져 있어요. 깨끗이 씻은 잎을 차에 우려 향을 내거나 음료, 과일에 조금 곁들이는 예가 있어요. 먹기 전에는 꼭 선생님이나 어른이 종류와 위생 상태를 먼저 확인해야 해요.',
      flowerInfo:
        '민트는 자라면 작은 꽃이 필 수 있어요. 줄기 끝과 잎 사이를 살펴봐요.',
      fruitInfo:
        '민트는 열매보다 잎, 줄기, 꽃 변화를 관찰하는 식물로 보는 게 좋아요.',
      observationPoints: '잎 냄새, 잎 색, 줄기 길이, 새 잎, 흙 상태',
      caution: '확인 전에는 잎을 따거나 입에 넣지 않아요.',
    },
  },
  {
    names: ['해바라기', 'sunflower'],
    draft: {
      summary:
        '해바라기는 키가 자라고 큰 꽃이 피는 과정을 관찰하기 좋은 식물이에요.',
      edibleInfo:
        '해바라기는 씨앗을 먹는 식물로 알려져 있지만, 씨앗이 충분히 여물고 깨끗하게 말랐는지 확인해야 해요. 볶거나 껍질을 벗겨 먹는 예가 있지만, 교실에서 기른 식물은 먹기 전 선생님이나 어른 확인이 필요해요.',
      flowerInfo:
        '해바라기는 잘 자라면 큰 노란 꽃을 피울 수 있어요. 꽃봉오리와 줄기 높이를 함께 관찰해요.',
      fruitInfo:
        '해바라기는 꽃이 진 뒤 씨앗이 생길 수 있어요. 씨앗이 생기는 과정은 천천히 관찰해요.',
      observationPoints: '줄기 높이, 잎 크기, 꽃봉오리, 꽃 색, 씨앗',
      caution: '씨앗이나 잎을 먹기 전에는 꼭 선생님이나 어른과 확인해요.',
    },
  },
  {
    names: ['고추', 'pepper', 'chili'],
    draft: {
      summary:
        '고추는 꽃이 피고 열매 색이 변하는 모습을 관찰하기 좋은 식물이에요.',
      edibleInfo:
        '고추는 보통 열매를 먹는 식물로 알려져 있지만 매울 수 있어요. 익은 열매를 깨끗이 씻어 음식에 아주 조금 넣어 맛을 내는 예가 있어요. 먹기 전에는 꼭 선생님이나 어른이 매운 정도와 위생 상태를 확인해야 해요.',
      flowerInfo:
        '고추는 자라면 작은 꽃이 필 수 있고, 꽃 뒤에 열매가 생길 수 있어요.',
      fruitInfo:
        '고추는 꽃 뒤에 열매가 생기고, 열매 색이 초록색에서 빨간색 등으로 달라질 수 있어요.',
      observationPoints: '꽃, 열매, 열매 색, 잎 색, 흙 상태',
      caution:
        '고추 열매는 매울 수 있으니 손으로 만진 뒤 눈을 비비지 않고, 먹기 전에는 꼭 확인해요.',
    },
  },
  {
    names: ['딸기', 'strawberry'],
    draft: {
      summary: '딸기는 꽃과 열매가 자라는 과정을 관찰하기 좋은 식물이에요.',
      edibleInfo:
        '딸기는 보통 빨갛게 익은 열매를 먹는 식물로 알려져 있어요. 빨갛게 익은 열매를 깨끗이 씻어 그대로 먹거나 요거트에 곁들이는 예가 있어요. 먹기 전에는 꼭 선생님이나 어른이 깨끗한지, 먹어도 되는 상태인지 먼저 확인해야 해요.',
      flowerInfo:
        '딸기는 작은 꽃이 필 수 있고, 꽃 뒤에 열매가 생길 수 있어요.',
      fruitInfo:
        '딸기는 열매가 자라며 색이 초록색이나 흰빛에서 빨간색으로 달라질 수 있어요.',
      observationPoints: '꽃, 열매 크기, 열매 색, 잎 모양, 흙 상태',
      caution:
        '먹기 전에는 깨끗한지, 먹어도 되는 상태인지 선생님이나 어른과 확인해요.',
    },
  },
  {
    names: ['라벤더', 'lavender'],
    draft: {
      summary:
        '라벤더는 향이 나는 잎과 보라색 꽃을 관찰하기 좋은 허브 식물이에요. 잎 색, 줄기 길이, 향, 꽃봉오리 변화를 살펴볼 수 있어요.',
      edibleInfo:
        '라벤더는 향을 이용하는 허브로 알려져 있지만, 교실에서 기른 식물은 먹기 전에 꼭 선생님이나 어른이 먼저 확인해야 해요.',
      flowerInfo:
        '라벤더는 잘 자라면 줄기 끝에 보라색 작은 꽃이 모여 필 수 있어요. 꽃봉오리가 생기는지 관찰해요.',
      fruitInfo:
        '라벤더는 열매보다 잎, 줄기, 꽃, 씨앗 변화를 관찰하는 식물로 보는 게 좋아요.',
      observationPoints: '잎 색, 잎 향, 줄기 길이, 꽃봉오리, 흙 상태',
      caution:
        '향이 있어도 선생님 확인 전에는 잎이나 꽃을 먹지 않고, 향을 맡을 때도 너무 가까이 대지 않아요.',
    },
  },
];

function buildTtsInstructions() {
  return [
    'Speak in Korean.',
    'Use one fixed voice identity for all responses in this app.',
    'Use a calm, gentle, friendly plant friend voice for young children.',
    'Keep the same pitch, pace, volume, emotion, and energy every time.',
    'Do not change character, age, accent, acting style, or emotional intensity between responses.',
    'Avoid dramatic acting, whispering, surprise, sadness, or exaggerated cuteness.',
    'Speak clearly at a natural, lightly brisk pace for young children.',
    'Avoid long pauses between phrases.',
    'Finish the entire sentence. Do not trail off or stop early.',
    'Do not sound like an announcer, narrator, robot, or serious adult.',
    'Do not imitate a specific real child or real person.',
  ].join(' ');
}

function getOpenAIClient(apiKey) {
  const effectiveApiKey = String(apiKey?.trim() || process.env.OPENAI_API_KEY || '').trim();

  if (!effectiveApiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  return new OpenAI({ apiKey: effectiveApiKey });
}

function getRequestOpenAiApiKey(req) {
  const headerKey = req.get('x-openai-api-key');
  const bodyKey = req.body?.openAiApiKey;
  const key = typeof headerKey === 'string' && headerKey.trim() ? headerKey : bodyKey;

  return typeof key === 'string' ? key.trim() : '';
}

function createFallbackPlantInfoDraft(plantType) {
  const safePlantType = String(plantType ?? '').trim() || '이 식물';
  const localDraft = findLocalPlantInfoDraft(safePlantType);
  const genericDetails = {
    originInfo:
      '어디에서 처음 자라던 식물인지와 널리 키워진 지역은 식물마다 달라요. 정확한 원산지는 선생님이 확인해 주세요.',
    classificationInfo:
      '식물은 잎, 줄기, 꽃, 열매가 있는지에 따라 여러 무리로 나눌 수 있어요. 이 식물은 잎과 줄기 변화를 중심으로 관찰해요.',
    nameStoryInfo:
      '식물 이름은 모양, 향, 색, 처음 알려진 지역에서 온 경우가 많아요. 정확한 이름 유래는 선생님이 확인해 주세요.',
    growthInfo:
      '얼마나 자라는지는 식물 종류와 환경에 따라 달라요. 같은 자리에서 키, 줄기 길이, 잎 수를 기록하면 자라는 속도를 비교할 수 있어요.',
    careInfo:
      '흙이나 재배 바닥이 마른 정도, 잎이 축 처졌는지, 햇빛이 너무 뜨겁지 않은지를 함께 보며 돌봐요.',
    lightInfo:
      '대부분의 교실 식물은 밝지만 잎이 뜨거워지지 않는 자리를 먼저 확인해요. 잎이 뜨겁거나 축 처지면 자리를 바꿔 볼 수 있어요.',
    environmentInfo:
      '실내에서 키우는지, 바깥에서 키우는지와 계절 온도에 따라 지내는 모습이 달라요. 추위, 더위, 바람, 너무 강한 햇빛은 잎 상태로 확인해요.',
    lifecycleInfo:
      '식물이 얼마나 오래 사는지와 시드는 시기는 종류와 환경에 따라 달라요. 잎 색이 변하거나 줄기 힘이 약해지면 시드는 신호일 수 있어요.',
    smellInfo:
      '향이 나는지는 식물마다 달라요. 좋은 향도 있고 거의 냄새가 나지 않을 수도 있어요. 이상한 냄새가 나면 선생님께 알려요.',
    favoriteInfo:
      '알맞은 물, 밝지만 뜨겁지 않은 빛, 부드러운 관찰을 좋아해요. 잎과 흙이 편안해 보이면 잘 지내는 신호일 수 있어요.',
    dislikeInfo:
      '흙이 너무 마르거나 물이 고이는 것, 잎이 뜨거워지는 것, 꺾이거나 뽑히는 것을 힘들어해요. 잎이 축 처지거나 색이 변하면 확인이 필요해요.',
    recommendedWaterIntervalDays: 2,
    recommendedSunGoal: 1,
    careChecklist:
      '흙이 말랐는지 만져보기, 잎이 뜨겁거나 축 처졌는지 보기, 밝은 자리인지 확인하기',
    childAnswerHints:
      '먹기 질문은 선생님 확인을 먼저 말하고, 꽃/열매/색/수명 질문은 저장된 정보로 답한 뒤 오늘 관찰할 단서로 이어가요.',
  };

  if (localDraft) {
    return {
      ...genericDetails,
      ...localDraft,
      confirmedAt: new Date().toISOString(),
    };
  }

  return {
    summary: `${safePlantType}의 자세한 정보는 선생님이 확인해 주세요. 아이들에게는 잎, 줄기, 흙, 햇빛 변화를 중심으로 관찰하도록 안내할 수 있어요.`,
    edibleInfo:
      '먹을 수 있는지는 아직 확인되지 않았어요. 먹기 전에는 꼭 선생님이나 어른이 먼저 확인해야 해요.',
    flowerInfo:
      '꽃이 피는지는 식물마다 달라요. 줄기 끝이나 잎 사이에 작은 변화가 있는지 관찰해요.',
    fruitInfo:
      '열매나 씨앗이 생기는지는 식물마다 달라요. 꽃이 진 자리와 줄기 주변을 살펴봐요.',
    observationPoints: '잎 색, 잎 모양, 새 잎, 줄기, 흙 상태, 햇빛 위치',
    caution: '이 식물은 확인 전까지 입에 넣지 않고, 꺾거나 뽑지 않아요.',
    ...genericDetails,
    confirmedAt: new Date().toISOString(),
  };
}

function normalizePlantName(value) {
  return String(value ?? '').replace(/\s/g, '').toLowerCase();
}

function normalizePlantText(value) {
  return normalizePlantName(value);
}

function findLocalPlantInfoDraft(plantType) {
  const normalizedPlantType = normalizePlantName(plantType);
  const match = localPlantInfoDrafts.find((item) =>
    item.names.some((name) => {
      const normalizedName = normalizePlantName(name);
      return (
        normalizedPlantType.includes(normalizedName) ||
        normalizedName.includes(normalizedPlantType)
      );
    })
  );

  return match?.draft;
}

function sanitizePlantInfoDraft(rawDraft, plantType) {
  const fallback = createFallbackPlantInfoDraft(plantType);

  return {
    summary:
      typeof rawDraft?.summary === 'string' && rawDraft.summary.trim()
        ? rawDraft.summary.trim()
        : fallback.summary,
    originInfo:
      typeof rawDraft?.originInfo === 'string' && rawDraft.originInfo.trim()
        ? rawDraft.originInfo.trim()
        : fallback.originInfo,
    classificationInfo:
      typeof rawDraft?.classificationInfo === 'string' &&
      rawDraft.classificationInfo.trim()
        ? rawDraft.classificationInfo.trim()
        : fallback.classificationInfo,
    nameStoryInfo:
      typeof rawDraft?.nameStoryInfo === 'string' && rawDraft.nameStoryInfo.trim()
        ? rawDraft.nameStoryInfo.trim()
        : fallback.nameStoryInfo,
    edibleInfo:
      typeof rawDraft?.edibleInfo === 'string' && rawDraft.edibleInfo.trim()
        ? rawDraft.edibleInfo.trim()
        : fallback.edibleInfo,
    flowerInfo:
      typeof rawDraft?.flowerInfo === 'string' && rawDraft.flowerInfo.trim()
        ? rawDraft.flowerInfo.trim()
        : fallback.flowerInfo,
    fruitInfo:
      typeof rawDraft?.fruitInfo === 'string' && rawDraft.fruitInfo.trim()
        ? rawDraft.fruitInfo.trim()
        : fallback.fruitInfo,
    observationPoints:
      typeof rawDraft?.observationPoints === 'string' &&
      rawDraft.observationPoints.trim()
        ? rawDraft.observationPoints.trim()
        : fallback.observationPoints,
    caution:
      typeof rawDraft?.caution === 'string' && rawDraft.caution.trim()
        ? rawDraft.caution.trim()
        : fallback.caution,
    growthInfo:
      typeof rawDraft?.growthInfo === 'string' && rawDraft.growthInfo.trim()
        ? rawDraft.growthInfo.trim()
        : fallback.growthInfo,
    careInfo:
      typeof rawDraft?.careInfo === 'string' && rawDraft.careInfo.trim()
        ? rawDraft.careInfo.trim()
        : fallback.careInfo,
    lightInfo:
      typeof rawDraft?.lightInfo === 'string' && rawDraft.lightInfo.trim()
        ? rawDraft.lightInfo.trim()
        : fallback.lightInfo,
    environmentInfo:
      typeof rawDraft?.environmentInfo === 'string' &&
      rawDraft.environmentInfo.trim()
        ? rawDraft.environmentInfo.trim()
        : fallback.environmentInfo,
    lifecycleInfo:
      typeof rawDraft?.lifecycleInfo === 'string' &&
      rawDraft.lifecycleInfo.trim()
        ? rawDraft.lifecycleInfo.trim()
        : fallback.lifecycleInfo,
    smellInfo:
      typeof rawDraft?.smellInfo === 'string' && rawDraft.smellInfo.trim()
        ? rawDraft.smellInfo.trim()
        : fallback.smellInfo,
    favoriteInfo:
      typeof rawDraft?.favoriteInfo === 'string' && rawDraft.favoriteInfo.trim()
        ? rawDraft.favoriteInfo.trim()
        : fallback.favoriteInfo,
    dislikeInfo:
      typeof rawDraft?.dislikeInfo === 'string' && rawDraft.dislikeInfo.trim()
        ? rawDraft.dislikeInfo.trim()
        : fallback.dislikeInfo,
    recommendedWaterIntervalDays: Math.min(
      14,
      Math.max(
        1,
        Math.round(
          Number(rawDraft?.recommendedWaterIntervalDays) ||
            fallback.recommendedWaterIntervalDays
        )
      )
    ),
    recommendedSunGoal: Math.min(
      5,
      Math.max(
        1,
        Math.round(Number(rawDraft?.recommendedSunGoal) || fallback.recommendedSunGoal)
      )
    ),
    careChecklist:
      typeof rawDraft?.careChecklist === 'string' &&
      rawDraft.careChecklist.trim()
        ? rawDraft.careChecklist.trim()
        : fallback.careChecklist,
    childAnswerHints:
      typeof rawDraft?.childAnswerHints === 'string' &&
      rawDraft.childAnswerHints.trim()
        ? rawDraft.childAnswerHints.trim()
        : fallback.childAnswerHints,
    confirmedAt: new Date().toISOString(),
  };
}

function buildPlantInfoDraftPrompt(plantType) {
  return [
    `식물 이름 또는 종류: ${plantType}`,
    '',
    '어린이 교실 관찰 앱에서 교사가 확인할 식물 정보 초안을 한국어로 작성해 주세요.',
    '정확한 품종이나 식용 가능 여부가 불확실하면 단정하지 말고 선생님/어른 확인이 필요하다고 쓰세요.',
    '아이에게 바로 먹으라고 하거나 약품/비료 사용을 권하지 마세요.',
    '문장은 초등학생에게 설명하기 쉬운 말로 작성하되, 교사가 검토할 수 있도록 각 항목은 정보가 충분해야 합니다.',
    '아이들이 자주 묻는 질문에 답할 수 있게 "언제", "어떤 색", "얼마나", "무엇을 좋아/싫어", "왜 시들어", "먹어도 돼"에 대한 단서를 넣으세요.',
    'summary에는 이 식물이 어떤 식물인지, 아이가 바로 관찰할 대표 특징 2~3개를 쓰세요.',
    'originInfo에는 원산지, 널리 자라는 지역, 실내/실외 환경 지식을 쓰세요. 정확하지 않으면 불확실하다고 쓰세요.',
    'classificationInfo에는 허브/채소/관엽/다육/새싹/꽃식물 등 아이가 이해할 수 있는 식물 종류와 특징을 쓰세요.',
    'nameStoryInfo에는 이름의 유래, 이름이 모양/향/색/지역과 관련되는지, 아이에게 설명할 기본 지식을 쓰세요.',
    'edibleInfo에는 먹을 수 있는 부위, 먹을 수 있는 시기/상태, 어떻게 섭취하는지 예시, 먹기 전 확인할 위생/안전 조건을 쓰세요. 예: 잎을 깨끗이 씻어 향내기나 샐러드에 조금 사용, 빨갛게 익은 열매를 씻어 먹기, 새싹을 잘라 씻어 샐러드에 곁들이기. 불확실하면 불확실하다고 쓰세요.',
    'flowerInfo에는 꽃이 필 수 있는지, 보통 꽃 색은 무엇인지, 어떤 시기/조건에서 피는지까지 아이 질문에 답할 수 있게 쓰세요.',
    'fruitInfo에는 열매/씨앗이 생기는지, 생긴다면 색 변화나 관찰 시기를 쓰세요.',
    'observationPoints는 "잎 색, 줄기 길이, 흙 상태"처럼 쉼표로 구분한 짧은 명사 목록으로 5~8개 작성하세요.',
    'caution에는 아이가 하지 말아야 할 행동과 선생님께 알려야 할 상황을 함께 쓰세요.',
    'growthInfo에는 얼마나/어떻게 자라는지 아이가 관찰할 수 있는 단서로 쓰세요.',
    'careInfo에는 물, 흙/재배 바닥, 햇빛, 온도, 위치 돌봄 힌트를 안전하게 쓰세요.',
    'recommendedWaterIntervalDays에는 보통 며칠마다 물을 확인/주는지 1~14 사이 숫자로 쓰세요. 물재배/새싹처럼 매일 확인이 필요하면 1을 쓰세요. 확실하지 않으면 2를 쓰세요.',
    'recommendedSunGoal에는 하루에 햇빛/밝은 자리 확인을 몇 번 하면 좋은지 1~5 사이 숫자로 쓰세요. 확실하지 않으면 1을 쓰세요.',
    'careChecklist에는 아이가 매일 확인할 돌봄 행동 3~5개를 쉼표로 구분해 쓰세요. 예: 흙 만져보기, 잎 처짐 보기, 밝은 자리 확인하기',
    'lightInfo에는 좋아하는 빛, 피해야 할 빛, 둘 장소를 쓰세요.',
    'environmentInfo에는 어떤 환경과 계절 조건에서 지내기 좋은지 쓰세요. 겨울/더위/실내온도 질문에 답할 수 있어야 합니다.',
    'lifecycleInfo에는 얼마나 오래 살 수 있는지, 언제 시들기 쉬운지, 계절성/한해살이/여러해살이 여부를 불확실하면 단정하지 않고 쓰세요.',
    'smellInfo에는 향이나 냄새 질문에 답할 정보를 쓰고, 이상한 냄새가 날 때의 안전 행동도 쓰세요.',
    'favoriteInfo에는 식물이 좋아하는 환경과 그 이유를 1~2문장으로 쓰세요.',
    'dislikeInfo에는 식물이 힘들어하는 환경과 나타날 수 있는 신호를 1~2문장으로 쓰세요.',
    'childAnswerHints에는 아이 질문에 답할 때 쓸 핵심 힌트 3~5개를 짧게 쓰세요. 예: 먹기 질문은 선생님 확인, 꽃 질문은 색/봉오리 관찰, 아픔 질문은 잎/흙/사진 확인',
    '',
    '반드시 JSON만 출력하세요. 키는 summary, originInfo, classificationInfo, nameStoryInfo, edibleInfo, flowerInfo, fruitInfo, observationPoints, caution, growthInfo, careInfo, recommendedWaterIntervalDays, recommendedSunGoal, careChecklist, lightInfo, environmentInfo, lifecycleInfo, smellInfo, favoriteInfo, dislikeInfo, childAnswerHints 입니다.',
  ].join('\n');
}

function getPlantInfoModels() {
  return [
    ...(process.env.OPENAI_PLANT_INFO_MODEL ?? '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean),
    DEFAULT_PLANT_INFO_MODEL,
  ].filter((model, index, models) => model && models.indexOf(model) === index);
}

function parsePlantInfoDraftJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('OpenAI response did not include text output');
  }

  try {
    return JSON.parse(text);
  } catch {
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      throw new Error('OpenAI response was not valid JSON');
    }

    return JSON.parse(text.slice(startIndex, endIndex + 1));
  }
}

function sanitizeVisibleOnlyText(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const text = value.trim();
  const unsafeDiagnosisPattern =
    /(썩|썩어|썩은|부패|곰팡|병해|병든|병이|해충|벌레|감염|세균|바이러스|뿌리썩|줄기썩)/;

  if (!unsafeDiagnosisPattern.test(text)) {
    return text;
  }

  return text
    .split(/(?<=[.!?。]|요\.|요)/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !unsafeDiagnosisPattern.test(sentence))
    .join(' ')
    .trim() || fallback;
}

function sanitizePhotoAnalysis(rawAnalysis) {
  const fallback = {
    isPlantPhoto: false,
    visibleDetails: '실제 식물이나 화분을 확실히 확인하기 어려워요.',
    uncertainDetails: '잎, 줄기, 흙 상태는 사진만으로 확인하기 어려워요.',
    summary: '사진에서 실제 식물을 확실히 확인하기 어려워요.',
    leafHint: '잎이 보이는 식물 사진인지 먼저 확인해 주세요.',
    soilHint: '흙은 사진에서 확인하기 어려워요.',
    action: '식물 전체, 잎, 흙이 보이게 다시 사진을 남겨 주세요.',
  };
  const rawIsPlantPhoto = rawAnalysis?.isPlantPhoto;
  const rawSummary = String(rawAnalysis?.summary ?? '');
  const inferredPlantPhoto =
    typeof rawIsPlantPhoto === 'boolean'
      ? rawIsPlantPhoto
      : !rawSummary.includes('식물 사진이 아니에요') &&
        !rawSummary.includes('실제 식물') &&
        !rawSummary.includes('확인하기 어려워요');

  const summary =
    sanitizeVisibleOnlyText(rawAnalysis?.summary, fallback.summary);
  const leafHint =
    sanitizeVisibleOnlyText(rawAnalysis?.leafHint, fallback.leafHint);
  const soilHint =
    sanitizeVisibleOnlyText(rawAnalysis?.soilHint, fallback.soilHint);

  return {
    isPlantPhoto: inferredPlantPhoto,
    visibleDetails:
      sanitizeVisibleOnlyText(rawAnalysis?.visibleDetails, summary || fallback.visibleDetails),
    uncertainDetails:
      sanitizeVisibleOnlyText(
        rawAnalysis?.uncertainDetails,
        `${leafHint} ${soilHint}`.trim() || fallback.uncertainDetails
      ),
    summary,
    leafHint,
    soilHint,
    action:
      sanitizeVisibleOnlyText(rawAnalysis?.action, fallback.action),
    checkedAt: new Date().toISOString(),
  };
}

function buildPhotoAnalysisPrompt({ plantName, plantType }) {
  return [
    `식물 이름: ${plantName || '이 식물'}`,
    `식물 종류: ${plantType || '종류를 아직 모르는 식물'}`,
    '',
    '어린이 교실 식물 관찰 앱에서 선생님이 사진을 확인하기 위한 AI 사진 관찰 결과를 작성해 주세요.',
    '반드시 사진 속에서 실제로 보이는 시각 단서만 말하세요.',
    '먼저 사진에 실제 살아있는 식물이나 화분이 보이는지 판단하세요.',
    '캐릭터, 로고, 사람, 그림, 장난감, 문구, 화면 캡처처럼 실제 식물 사진이 아니면 식물 분석을 하지 마세요.',
    '실제 식물이 아니면 isPlantPhoto는 false로 쓰세요.',
    '실제 식물이 아니면 visibleDetails는 "식물 사진이 아니에요. 실제 식물이나 화분이 보이지 않아요."라고 쓰세요.',
    '실제 식물이 아니면 uncertainDetails는 "잎, 줄기, 흙 상태를 확인할 수 없어요."라고 쓰세요.',
    '실제 식물이 아니면 summary는 "식물 사진이 아니에요. 실제 식물이 보이는 사진을 다시 올려 주세요."라고 쓰고, leafHint와 soilHint는 "확인할 수 없어요."라고 쓰세요.',
    '실제 식물이 아니면 action은 "식물 전체, 잎, 흙이 보이게 다시 사진을 남겨 주세요."라고 쓰세요.',
    '실제 식물이면 isPlantPhoto는 true로 쓰세요.',
    'visibleDetails에는 사진에서 보이는 것만 2~3개 적으세요.',
    'uncertainDetails에는 사진만으로 확인하기 어려운 것을 적으세요. 예: 흙이 가려짐, 잎 뒷면이 안 보임, 빛 때문에 색이 애매함.',
    '사진 속 식물이 등록된 식물 종류와 같은지 확실하지 않으면 uncertainDetails에 "등록된 식물과 같은지 선생님 확인이 필요해요."를 포함하세요.',
    '사진 속 잎 모양이나 전체 모습이 등록된 식물 종류와 뚜렷하게 달라 보이면 summary나 action에 "등록된 식물과 다를 수 있어요. 선생님이 먼저 확인해 주세요."라고 쓰세요.',
    '단, 사진만 보고 식물 이름을 새로 단정하지 마세요. "다른 식물이에요"라고 확정하지 말고 "다를 수 있어요"라고 표현하세요.',
    'summary에는 사진에서 보이는 구체적 단서 2~3개를 말하세요. 예: 잎 색, 잎 처짐, 새잎, 줄기 방향, 흙이 보이는지, 화분/위치.',
    'leafHint에는 잎에서 보이는 점을 구체적으로 말하세요. 잎이 잘 안 보이면 잘 안 보인다고 쓰세요.',
    'soilHint에는 흙이 보이는지 여부를 먼저 말하세요. 흙이 안 보이면 실제로 만져 확인하라고 쓰세요.',
    'action에는 사진을 바탕으로 다음에 할 관찰 행동 하나를 제안하세요.',
    '줄기, 뿌리, 흙, 잎 일부가 사진에서 가려져 있으면 보인다고 말하지 말고 "사진에서는 확인하기 어려워요"라고 쓰세요.',
    '사진에서 명확히 보이지 않는 문제를 원인처럼 말하지 마세요. 특히 썩음, 곰팡이, 병, 해충, 감염, 뿌리 문제, 줄기 문제를 단정하지 마세요.',
    '어두운 부분이나 그림자는 썩음이라고 부르지 말고 "색이 어둡게 보이는 부분이 있어요"처럼 보이는 모습만 말하세요.',
    '상태가 걱정되어도 해결책은 관찰 행동으로 제한하세요. 예: 같은 자리에서 다시 사진 찍기, 잎 앞뒤 보기, 흙 만져 보기, 선생님께 확인받기.',
    '식물 이름이나 종류 정보만 반복하지 마세요. 사진을 보지 않아도 할 수 있는 일반 설명으로 채우지 마세요.',
    '사진에 보이지 않는 내용을 추측하지 말고 "사진에서는 확인하기 어려워요"라고 쓰세요.',
    '병명이나 원인을 단정하지 마세요.',
    '약품, 비료, 농약 사용을 권하지 마세요.',
    '먹어도 된다는 판단은 하지 마세요.',
    '문장은 한국어로 짧고 부드럽게 작성하세요. 각 값은 1~2문장으로 제한하세요.',
    '',
    '반드시 JSON만 출력하세요. 키는 isPlantPhoto, visibleDetails, uncertainDetails, summary, leafHint, soilHint, action 입니다.',
  ].join('\n');
}

function parsePhotoAnalysisJson(text) {
  return parsePlantInfoDraftJson(text);
}

async function generatePhotoAnalysis({ plantName, plantType, imageData, openAiApiKey }) {
  const openai = getOpenAIClient(openAiApiKey);
  const model = process.env.OPENAI_PHOTO_ANALYSIS_MODEL || DEFAULT_PHOTO_ANALYSIS_MODEL;

  const response = await withTimeout(
    openai.responses.create({
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildPhotoAnalysisPrompt({ plantName, plantType }),
            },
            {
              type: 'input_image',
              image_url: imageData,
              detail: 'auto',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
    PHOTO_ANALYSIS_TIMEOUT_MS,
    'Photo analysis request'
  );

  return sanitizePhotoAnalysis(parsePhotoAnalysisJson(response.output_text));
}

function buildChatAnswerPrompt({
  question,
  fallbackAnswer,
  plantName,
  plantType,
  teacherInfo,
  careState,
  recentRecords,
  latestPhotoAnalysis,
}) {
  return [
    '어린이 교실 식물 관찰 앱의 식물 캐릭터로 한국어 답변을 작성하세요.',
    '',
    `식물 이름: ${plantName}`,
    `식물 종류: ${plantType}`,
    `아이 질문: ${question}`,
    `앱 안전 기본 답변: ${fallbackAnswer}`,
    '',
    '중요 규칙:',
    '- 답변은 1~2문장, 90자 이내로 짧게 작성하세요.',
    '- 아이에게 따뜻하게 답하되 식물이 실제 사람 감정, 가족, 결혼, 꿈, 생각을 가진다고 단정하지 마세요.',
    '- 엉뚱한 질문도 식물 입장에서 짧게 받아주고, 반드시 관찰 행동으로 연결하세요.',
    '- 모르는 식물 정보는 지어내지 말고 관찰로 연결하세요.',
    '- 먹기, 만지기, 약, 비료, 병, 독성, 치료 판단은 하지 말고 선생님/어른 확인을 말하세요.',
    '- 최근 기록과 교사 확인 정보가 있으면 우선 반영하세요.',
    '- 마지막에는 가능하면 잎, 줄기, 흙, 햇빛, 사진 중 하나를 관찰하도록 자연스럽게 이어 주세요.',
    '- 식물 이름을 앞에 붙이지 마세요. 앱이 화면에서 이름을 따로 붙입니다.',
    '',
    '교사 확인 정보:',
    JSON.stringify(teacherInfo ?? {}, null, 2),
    '',
    '돌보기 상태:',
    JSON.stringify(careState ?? {}, null, 2),
    '',
    '최근 관찰 기록:',
    JSON.stringify(recentRecords ?? [], null, 2),
    '',
    '최근 사진 분석:',
    JSON.stringify(latestPhotoAnalysis ?? {}, null, 2),
  ].join('\n');
}

function sanitizeChatAnswer(value, fallbackAnswer) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallbackAnswer;
  }

  const text = value
    .replace(/^["']|["']$/g, '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return fallbackAnswer;

  const unsafePattern =
    /(먹어도 돼|먹어도 좋아|입에 넣어|약을 뿌려|비료를 줘|치료해|병에 걸렸|독성이 없)/;

  if (unsafePattern.test(text)) {
    return fallbackAnswer;
  }

  return text.length > 120 ? `${text.slice(0, 118)}…` : text;
}

function isPlantChatScope(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  const plantKeywords = [
    '식물',
    '잎',
    '줄기',
    '뿌리',
    '흙',
    '물',
    '비',
    '빗물',
    '햇빛',
    '화분',
    '자라',
    '시들',
    '죽',
    '아파',
    '아프',
    '괜찮',
    '상태',
    '힘들',
    '꽃',
    '만져',
    '만질',
    '추우',
    '추워',
    '열매',
    '씨앗',
    '나라',
    '원산지',
    '종류',
    '분류',
    '유래',
    '뜻',
    '먹',
    '수확',
    '따',
    '나와',
    '너',
    '너는',
    '기분',
    '좋아',
    '싫어',
    '배고',
    '목말',
    '잠',
    '밤',
    '꿈',
    '말',
    '말못',
    '나이',
    '엄마',
    '아빠',
    '아기',
    '결혼',
    '화장실',
    '노래',
    '예쁜말',
    '칭찬',
    '심심',
    '놀이',
    '웃',
    '울',
    '친구',
  ];

  const unsafeNonPlantKeywords = [
    '때려',
    '죽여',
    '미워해',
    '바보',
    '싫어해줘',
    '개인정보',
    '전화번호',
    '주소',
  ];

  if (unsafeNonPlantKeywords.some((keyword) => compactQuestion.includes(keyword))) {
    return false;
  }

  return true;
}

function isBarleySproutPlant(plantName, plantType) {
  const text = `${plantName ?? ''} ${plantType ?? ''}`
    .replace(/\s/g, '')
    .toLowerCase();

  return (
    text.includes('보리') ||
    text.includes('새싹') ||
    text.includes('barley') ||
    text.includes('sprout')
  );
}

function isOrangeGeraniumPlant(plantName, plantType) {
  const text = `${plantName ?? ''} ${plantType ?? ''}`
    .replace(/\s/g, '')
    .toLowerCase();

  return (
    text.includes('오렌지제라늄') ||
    text.includes('제라늄') ||
    text.includes('geranium')
  );
}

function isEdibleTimingQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  const keywords = [
    '언제먹',
    '먹을수',
    '먹어도',
    '먹는부분',
    '뭘먹',
    '어디먹',
    '어떻게먹',
    '먹는방법',
    '먹을방법',
    '먹는법',
    '어찌먹',
    '뭐해먹',
    '뭐로먹',
    '먹을때',
    '먹는거',
    '어떻게요리',
    '요리해',
    '수확',
    '언제따',
  ];

  return keywords.some((keyword) => compactQuestion.includes(keyword));
}

function isRegrowthAfterHarvestQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  const regrowthKeywords = [
    '또자라',
    '다시자라',
    '계속자라',
    '또나와',
    '다시나와',
    '또나요',
    '다시나요',
  ];
  const harvestKeywords = ['먹', '자르', '따', '수확'];

  return (
    regrowthKeywords.some((keyword) => compactQuestion.includes(keyword)) &&
    harvestKeywords.some((keyword) => compactQuestion.includes(keyword))
  );
}

function isFlowerQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['꽃', '피어', '펴'].some((keyword) => compactQuestion.includes(keyword));
}

function isNoFlowerQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    isFlowerQuestion(question) &&
    ['안피', '안펴', '안나', '없어'].some((keyword) =>
      compactQuestion.includes(keyword)
    )
  );
}

function isTouchQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['만져', '만져도', '만질', '만져볼'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isColorQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['무슨색', '색깔', '색이', '어떤색'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isBloomTimingQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    isFlowerQuestion(question) &&
    ['언제', '몇월', '계절', '시기'].some((keyword) =>
      compactQuestion.includes(keyword)
    )
  );
}

function isFlowerWiltTimingQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    isFlowerQuestion(question) &&
    ['시들', '지는', '져', '떨어'].some((keyword) =>
      compactQuestion.includes(keyword)
    )
  );
}

function isFruitQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['열매', '씨앗', '꼬투리', '딸기', '토마토'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isGrowthQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['얼마나자', '얼마나커', '얼마나길', '키가', '길이', '자라'].some(
    (keyword) => compactQuestion.includes(keyword)
  );
}

function isWhyRootGoesDownQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    compactQuestion.includes('뿌리') &&
    ['왜', '이유', '아래', '밑', '내려'].some((keyword) =>
      compactQuestion.includes(keyword)
    )
  );
}

function isWhyStemGrowsQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    compactQuestion.includes('줄기') &&
    ['왜', '이유'].some((keyword) => compactQuestion.includes(keyword)) &&
    ['길', '자라', '커'].some((keyword) => compactQuestion.includes(keyword))
  );
}

function isWhySproutComesQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    compactQuestion.includes('싹') &&
    ['왜', '이유', '나'].some((keyword) => compactQuestion.includes(keyword))
  );
}

function isWhyLeafIsGreenQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    compactQuestion.includes('잎') &&
    ['왜', '이유'].some((keyword) => compactQuestion.includes(keyword)) &&
    ['초록', '초록색', '푸른'].some((keyword) => compactQuestion.includes(keyword))
  );
}

function isPodQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return compactQuestion.includes('꼬투리');
}

function isInsidePodQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    isPodQuestion(question) &&
    ['안', '속', '뭐', '무엇'].some((keyword) => compactQuestion.includes(keyword))
  );
}

function isGrowthAtNightQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return (
    isSleepQuestion(question) &&
    ['자라', '커', '크'].some((keyword) => compactQuestion.includes(keyword))
  );
}

function isCareQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return [
    '어떻게키',
    '어떻게돌',
    '키우는법',
    '돌보는법',
    '관리',
    '잘살',
    '건강',
    '필요한거',
    '필요한것',
  ].some((keyword) => compactQuestion.includes(keyword));
}

function isWaterScheduleQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['며칠마다', '몇일마다', '얼마마다', '물주기', '언제물', '언제줘'].some(
    (keyword) => compactQuestion.includes(keyword)
  );
}

function isRainQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['비오는', '비온', '비가', '빗물', '비맞'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isTalkingQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['말할수', '말해', '말을못', '왜말', '말못', '목소리'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isSleepQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['잠', '자니', '자는', '밤', '꿈'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isSunOrLightQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['햇빛', '햇볕', '해를', '해가', '해빛', '빛', '밝은', '어두'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isSoilRoleQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  const hasSoil = compactQuestion.includes('흙');
  const asksRole = ['왜', '필요', '뭐해', '무슨일', '역할', '왜있', '왜필요'].some(
    (keyword) => compactQuestion.includes(keyword)
  );

  return hasSoil && asksRole;
}

function isNoSoilGrowthQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  const hasSoil = compactQuestion.includes('흙');
  const asksNoSoil = ['없어도', '없이', '없는데', '안써도', '안심어도', '안심고'].some(
    (keyword) => compactQuestion.includes(keyword)
  );
  const asksGrowth = ['자라', '커', '살', '키워'].some((keyword) =>
    compactQuestion.includes(keyword)
  );

  return hasSoil && asksNoSoil && asksGrowth;
}

function isWhiteThingQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['하얀', '하얗', '흰', '흰색', '곰팡'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isPlaceOrSeasonQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return [
    '어디',
    '자리',
    '놓아',
    '둬',
    '겨울',
    '여름',
    '봄',
    '가을',
    '계절',
    '추워',
    '추우',
    '춥',
    '차가',
    '차갑',
    '더워',
    '더우',
    '뜨거',
    '뜨겁',
    '살수',
  ].some((keyword) => compactQuestion.includes(keyword));
}

function isLifecycleQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['언제시들', '시들때', '죽어', '죽니', '얼마나살', '몇년', '수명', '오래살', '계속살'].some(
    (keyword) => compactQuestion.includes(keyword)
  );
}

function isSmellQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['냄새', '향', '향기'].some((keyword) => compactQuestion.includes(keyword));
}

function isFavoriteQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['좋아하는', '무엇을좋아', '뭘좋아', '뭐좋아', '언제좋아'].some(
    (keyword) => compactQuestion.includes(keyword)
  );
}

function isDislikeQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['싫어', '싫니', '힘들어', '무서워'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
}

function isHelpingPainQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  const asksPain = ['아파', '아프', '아픈', '상태', '힘들어'].some((keyword) =>
    compactQuestion.includes(keyword)
  );
  const asksHelp = ['도와', '도움', '어떻게', '어찌', '뭐해', '무엇'].some(
    (keyword) => compactQuestion.includes(keyword)
  );

  return asksPain && asksHelp;
}

function isOriginQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return [
    '어느나라',
    '어디나라',
    '원산지',
    '어디에서왔',
    '어디서왔',
    '어디식물',
    '사는곳',
  ].some((keyword) => compactQuestion.includes(keyword));
}

function isClassificationQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['어떤식물', '무슨식물', '종류', '분류', '허브', '채소', '관엽', '다육'].some(
    (keyword) => compactQuestion.includes(keyword)
  );
}

function isNameStoryQuestion(question) {
  const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return ['이름왜', '왜이름', '이름유래', '무슨뜻', '뜻이', '왜그런이름'].some(
    (keyword) => compactQuestion.includes(keyword)
  );
}

function makeTeacherInfoAnswer(text, suffix) {
  const safeText = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!safeText) return '';
  return suffix ? `${safeText} ${suffix}` : safeText;
}

function createEdibleAnswerText(edibleText, wantsMethod) {
  const sentences = String(edibleText ?? '')
    .split(/[.!?。]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const safetySuffix =
    '교실에서는 먹기 전에 선생님이 정확한 종류와 위생 상태를 먼저 확인해 주세요.';
  const methodSentences = sentences.filter((sentence) =>
    [
      '씻',
      '샐러드',
      '요리',
      '차에',
      '우려',
      '음료',
      '곁들이',
      '그대로',
      '주스',
      '갈아',
      '향',
      '조금 넣',
    ].some((keyword) => sentence.includes(keyword))
  );
  const infoSentences = sentences.filter(
    (sentence) =>
      !['반드시', '꼭', '확인', '위생', '안전'].some((keyword) =>
        sentence.includes(keyword)
      )
  );
  const baseSentences = wantsMethod
    ? methodSentences.length > 0
      ? methodSentences
      : []
    : infoSentences.length > 0
      ? infoSentences
      : sentences;
  const body = baseSentences.slice(0, 2).join('. ');

  if (wantsMethod && !body) {
    const ediblePart = String(edibleText ?? '').includes('잎')
      ? '저장된 정보로는 먹을 수 있는 부위가 잎이라는 것만 확인돼요.'
      : '저장된 정보에는 먹는 방법 예시가 아직 자세히 없어요.';

    return `${ediblePart} ${safetySuffix}`;
  }

  return `${body || edibleText} ${safetySuffix}`.replace(/\s+/g, ' ').trim();
}

function isKnownEdibleText(text) {
  const safeText = String(text ?? '');
  const edibleKeywords = [
    '먹는 식물로 알려',
    '먹을 수 있는 식물로 알려',
    '잎을 먹',
    '열매를 먹',
    '씨앗을 먹',
    '샐러드',
    '요리',
    '차에',
    '향내기',
    '곁들이',
    '수확해 먹',
  ];

  return edibleKeywords.some((keyword) => safeText.includes(keyword));
}

function isLikelyNotEdibleText(text) {
  const safeText = String(text ?? '');
  const unsafeKeywords = [
    '확실하지',
    '확인되지',
    '독성',
    '먹지 않는',
    '먹지않는',
    '먹는 식물로 보기보다',
    '식용 가능 여부',
  ];

  return !isKnownEdibleText(safeText) && unsafeKeywords.some((keyword) => safeText.includes(keyword));
}

function createLocalChatAnswer({ question, plantName, plantType, teacherInfo }) {
  const safeFlowerInfo =
    typeof teacherInfo?.flowerInfo === 'string' && teacherInfo.flowerInfo.trim()
      ? teacherInfo.flowerInfo.trim()
      : '';
  const safeSummary =
    typeof teacherInfo?.summary === 'string' && teacherInfo.summary.trim()
      ? teacherInfo.summary.trim()
      : '';
  const safeOriginInfo =
    typeof teacherInfo?.originInfo === 'string' && teacherInfo.originInfo.trim()
      ? teacherInfo.originInfo.trim()
      : '';
  const safeClassificationInfo =
    typeof teacherInfo?.classificationInfo === 'string' &&
    teacherInfo.classificationInfo.trim()
      ? teacherInfo.classificationInfo.trim()
      : '';
  const safeNameStoryInfo =
    typeof teacherInfo?.nameStoryInfo === 'string' &&
    teacherInfo.nameStoryInfo.trim()
      ? teacherInfo.nameStoryInfo.trim()
      : '';
  const safeFruitInfo =
    typeof teacherInfo?.fruitInfo === 'string' && teacherInfo.fruitInfo.trim()
      ? teacherInfo.fruitInfo.trim()
      : '';
  const safeGrowthInfo =
    typeof teacherInfo?.growthInfo === 'string' && teacherInfo.growthInfo.trim()
      ? teacherInfo.growthInfo.trim()
      : '';
  const safeCareInfo =
    typeof teacherInfo?.careInfo === 'string' && teacherInfo.careInfo.trim()
      ? teacherInfo.careInfo.trim()
      : '';
  const safeLightInfo =
    typeof teacherInfo?.lightInfo === 'string' && teacherInfo.lightInfo.trim()
      ? teacherInfo.lightInfo.trim()
      : '';
  const safeEnvironmentInfo =
    typeof teacherInfo?.environmentInfo === 'string' &&
    teacherInfo.environmentInfo.trim()
      ? teacherInfo.environmentInfo.trim()
      : '';
  const safeLifecycleInfo =
    typeof teacherInfo?.lifecycleInfo === 'string' &&
    teacherInfo.lifecycleInfo.trim()
      ? teacherInfo.lifecycleInfo.trim()
      : '';
  const safeSmellInfo =
    typeof teacherInfo?.smellInfo === 'string' && teacherInfo.smellInfo.trim()
      ? teacherInfo.smellInfo.trim()
      : '';
  const safeFavoriteInfo =
    typeof teacherInfo?.favoriteInfo === 'string' &&
    teacherInfo.favoriteInfo.trim()
      ? teacherInfo.favoriteInfo.trim()
      : '';
  const safeDislikeInfo =
    typeof teacherInfo?.dislikeInfo === 'string' &&
    teacherInfo.dislikeInfo.trim()
      ? teacherInfo.dislikeInfo.trim()
      : '';
  const safeEdibleInfo =
    typeof teacherInfo?.edibleInfo === 'string' && teacherInfo.edibleInfo.trim()
      ? teacherInfo.edibleInfo.trim()
      : '';

  if (safeOriginInfo && isOriginQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeOriginInfo,
      '오늘은 내가 그 환경을 좋아하는지 잎과 줄기를 살펴봐 주세요.'
    );
  }

  if (isWhyRootGoesDownQuestion(question)) {
    return '뿌리는 물을 찾고 식물을 단단히 붙잡으려고 아래쪽으로 자라요. 오늘은 흙 가까이에 뿌리나 줄기 아랫부분이 보이는지 살펴봐 주세요.';
  }

  if (isWhyStemGrowsQuestion(question)) {
    return '줄기는 잎이 햇빛을 더 잘 받을 수 있게 위로 길어져요. 햇빛이 부족하면 길지만 약하게 자랄 수도 있으니, 줄기가 곧고 튼튼한지 살펴봐 주세요.';
  }

  if (isWhySproutComesQuestion(question)) {
    return '씨앗이 물을 만나면 안에서 잠자던 새 식물이 깨어나 싹이 나와요. 오늘은 싹이 어느 쪽으로 자라는지, 잎이 펼쳐졌는지 살펴봐 주세요.';
  }

  if (isWhyLeafIsGreenQuestion(question)) {
    return '잎이 초록색인 건 햇빛을 받아 양분을 만드는 초록 성분이 있기 때문이에요. 오늘은 잎 색이 고르게 초록색인지 살펴봐 주세요.';
  }

  if (isInsidePodQuestion(question)) {
    return '꼬투리 안에는 콩 씨앗이 들어 있어요. 처음에는 작고 부드럽다가 시간이 지나며 점점 단단해질 수 있어요. 꼬투리 모양과 크기를 관찰해 봐요.';
  }

  if (isPodQuestion(question)) {
    return '꼬투리는 콩 씨앗을 감싸고 있는 열매예요. 꽃이 진 뒤에 생길 수 있고, 안에서 씨앗이 자라는 모습을 관찰할 수 있어요.';
  }

  if (isGrowthAtNightQuestion(question)) {
    return '밤에도 아주 천천히 자랄 수 있어요. 낮에 받은 빛과 물을 이용해 조용히 쉬고 자라요. 내일 아침 길이나 잎 수를 비교해 봐요.';
  }

  if (isPlaceOrSeasonQuestion(question)) {
    const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();

    if (
      ['추워', '추우', '춥', '차가'].some((keyword) =>
        compactQuestion.includes(keyword)
      )
    ) {
      return '너무 추우면 자라는 속도가 느려지고 잎이 축 처질 수 있어요. 찬바람을 바로 맞지 않는 따뜻한 실내인지 살펴봐 주세요.';
    }

    if (
      ['더워', '더우', '뜨거'].some((keyword) =>
        compactQuestion.includes(keyword)
      )
    ) {
      return '너무 더우면 잎이 축 처지거나 흙이 빨리 마를 수 있어요. 잎이 뜨거워지지 않는 밝은 자리인지, 흙이 말랐는지 살펴봐 주세요.';
    }
  }

  if (isBarleySproutPlant(plantName, plantType) && isClassificationQuestion(question)) {
    return '보리새싹은 씨앗에서 싹이 나와 빠르게 자라는 식물이에요. 오늘은 키가 얼마나 컸는지, 잎이 초록색인지, 바닥이 촉촉한지 살펴봐 주세요.';
  }

  if (safeClassificationInfo && isClassificationQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeClassificationInfo,
      '오늘은 잎 모양, 줄기, 꽃봉오리 같은 특징을 찾아봐 주세요.'
    );
  }

  if (safeNameStoryInfo && isNameStoryQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeNameStoryInfo,
      '이름과 닮은 점이 보이는지 내 모습을 살펴봐 주세요.'
    );
  }

  if (safeSummary && isClassificationQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeSummary,
      '오늘은 잎, 줄기, 흙 중 하나를 골라 관찰해 봐요.'
    );
  }

  if (safeEdibleInfo && isEdibleTimingQuestion(question)) {
    if (isLikelyNotEdibleText(safeEdibleInfo)) {
      return '나는 먹는 식물로 보지 않는 게 좋아요. 선생님이 확인해 주기 전에는 먹거나 입에 넣지 말아요.';
    }

    return createEdibleAnswerText(safeEdibleInfo, true);
  }

  if (isTalkingQuestion(question)) {
    const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();

    if (
      compactQuestion.includes('왜말') ||
      compactQuestion.includes('말을못') ||
      compactQuestion.includes('말못')
    ) {
      return '나는 사람처럼 입과 목소리가 없어서 말을 하지는 못해요. 대신 잎 색, 줄기 힘, 흙 느낌으로 내 상태를 알려줄 수 있어요.';
    }

    return '진짜 목소리는 없지만, 잎과 흙 상태로 마음을 알려줄 수 있어요. 오늘 내 흙과 잎을 한번 살펴봐 주세요.';
  }

  if (isRainQuestion(question)) {
    return '비 오는 날은 물을 만날 수 있어서 좋을 때도 있지만, 너무 오래 젖으면 힘들 수 있어요. 교실에서는 흙이 너무 젖었는지와 잎이 축 처지지 않는지 살펴봐 주세요.';
  }

  if (isSleepQuestion(question)) {
    const compactQuestion = String(question ?? '').replace(/\s/g, '').toLowerCase();

    if (compactQuestion.includes('꿈')) {
      return '나는 사람처럼 꿈을 꾸지는 않아요. 밤에는 조용히 쉬면서 물과 빛을 만난 하루를 지나 보내요. 내일 잎이 달라졌는지 봐 주세요.';
    }

    if (compactQuestion.includes('밤')) {
      return '밤에는 눈에 잘 보이지 않아도 조용히 쉬고 있어요. 너무 춥지 않은지, 아침에 잎이 싱싱한지 살펴봐 주세요.';
    }

    return '나는 눈을 감고 자지는 않지만 밤에는 조용히 쉬어요. 내일 잎이 더 싱싱해졌는지 봐 주세요.';
  }

  if (isTouchQuestion(question)) {
    return '살짝 만져 보는 건 선생님과 함께 할 때만 좋아요. 잎을 세게 누르거나 비비거나 따지 말고, 손가락으로 아주 부드럽게 잎 느낌만 확인해요.';
  }

  if (isNoSoilGrowthQuestion(question)) {
    if (isBarleySproutPlant(plantName, plantType)) {
      return '보리새싹은 흙 대신 키친타월이나 물이 있는 바닥에서도 자랄 수 있어요. 바닥이 촉촉한지, 물이 고이지 않았는지, 냄새나 하얀 것이 없는지 살펴봐 주세요.';
    }

    return '대부분의 화분 식물은 뿌리를 붙잡고 물을 머금을 흙이나 비슷한 재배 바닥이 필요해요. 흙이 없으면 뿌리가 힘들 수 있어요.';
  }

  if (isWhiteThingQuestion(question)) {
    if (isBarleySproutPlant(plantName, plantType)) {
      return '하얀 것이 보이면 뿌리털일 수도 있고 곰팡이일 수도 있어요. 냄새가 나거나 솜처럼 번지면 만지거나 먹지 말고 선생님께 바로 보여 주세요.';
    }

    return '하얀 것이 보이면 곰팡이나 흙 위의 변화일 수 있어요. 손으로 만지지 말고 사진을 남긴 뒤 선생님께 알려 주세요.';
  }

  if (isSoilRoleQuestion(question)) {
    if (isBarleySproutPlant(plantName, plantType)) {
      return '새싹은 흙 대신 키친타월이나 물이 있는 바닥에서 자라기도 해요. 바닥이 촉촉한지, 냄새나 곰팡이가 없는지 살펴봐 주세요.';
    }

    return '흙은 뿌리를 붙잡아 주고 물과 영양분을 머금어 줘요. 오늘 흙이 촉촉한지, 너무 단단하지 않은지 살펴봐 주세요.';
  }

  if (isPlaceOrSeasonQuestion(question) && safeEnvironmentInfo) {
    return makeTeacherInfoAnswer(
      safeEnvironmentInfo,
      '추울 때는 잎이 축 처지거나 색이 변할 수 있으니 따뜻한 실내인지 살펴봐 주세요.'
    );
  }

  if (isNoFlowerQuestion(question)) {
    return '꽃이 안 피어도 꼭 아픈 건 아니에요. 빛, 온도, 물, 자라는 시기가 맞아야 꽃이 필 수 있어요. 오늘은 줄기 끝이나 잎 사이에 꽃봉오리가 있는지 살펴봐 주세요.';
  }

  if (isOrangeGeraniumPlant(plantName, plantType)) {
    if (isFlowerQuestion(question) && isColorQuestion(question)) {
      return '오렌지제라늄은 작은 연분홍색이나 연보라색, 흰빛 꽃이 필 수 있어요. 이름의 오렌지는 꽃 색보다 향이나 이름을 뜻하는 경우가 많아요.';
    }

    if (isColorQuestion(question)) {
      return '잎은 보통 초록색이고, 꽃은 작은 연분홍색이나 연보라색, 흰빛으로 필 수 있어요. 오늘은 잎 색과 꽃봉오리가 있는지 같이 살펴봐 주세요.';
    }

    if (isFlowerWiltTimingQuestion(question)) {
      return '꽃은 핀 뒤 시간이 지나면 자연스럽게 시들 수 있어요. 꽃잎이 마르거나 색이 흐려지면 사진으로 남기고, 선생님과 함께 시든 꽃을 정리할지 확인해요.';
    }

    if (isBloomTimingQuestion(question)) {
      return '오렌지제라늄은 따뜻하고 밝은 시기에 꽃이 필 수 있어요. 실내에서는 햇빛, 온도, 물이 잘 맞을 때 꽃봉오리가 생기는지 살펴봐 주세요.';
    }
  }

  if (safeFlowerInfo && isFlowerQuestion(question) && isColorQuestion(question)) {
    return `${safeFlowerInfo} 오늘은 꽃봉오리나 꽃잎 색이 보이는지 살펴봐 주세요.`;
  }

  if (isFlowerWiltTimingQuestion(question)) {
    return '꽃은 핀 뒤 시간이 지나면 자연스럽게 시들 수 있어요. 색이 흐려지거나 꽃잎이 마르면 사진으로 남기고 선생님과 함께 확인해요.';
  }

  if (safeFlowerInfo && isBloomTimingQuestion(question)) {
    return `${safeFlowerInfo} 꽃봉오리가 생기는 시기는 빛, 온도, 물 상태에 따라 달라질 수 있어요.`;
  }

  if (safeSummary && isColorQuestion(question)) {
    return `${safeSummary} 오늘은 잎 색이나 꽃봉오리 색이 보이는지 살펴봐 주세요.`;
  }

  if (safeFruitInfo && isFruitQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeFruitInfo,
      '오늘은 꽃이 진 자리나 줄기 주변에 작은 변화가 있는지 살펴봐 주세요.'
    );
  }

  if (isSunOrLightQuestion(question) && isGrowthQuestion(question)) {
    if (safeLightInfo) {
      return `${safeLightInfo} 햇빛을 많이 본다고 무조건 빨리 자라지는 않아요. 잎이 뜨거워지지 않는지 함께 살펴봐 주세요.`;
    }

    return '햇빛은 자라는 데 필요하지만, 많이 본다고 무조건 빨리 자라지는 않아요. 잎이 뜨겁지 않은 밝은 자리인지 살펴봐 주세요.';
  }

  if (safeGrowthInfo && isGrowthQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeGrowthInfo,
      '오늘 키나 잎 수를 기록하고 다음 기록과 비교해 봐요.'
    );
  }

  if (safeCareInfo && (isCareQuestion(question) || isWaterScheduleQuestion(question))) {
    const waterInterval = Number(teacherInfo?.recommendedWaterIntervalDays);
    const waterHint =
      Number.isFinite(waterInterval) && waterInterval > 0
        ? `보통 ${waterInterval}일마다 물 상태를 확인해요.`
        : '';

    return makeTeacherInfoAnswer(
      `${safeCareInfo} ${waterHint}`.trim(),
      '그래도 오늘은 먼저 흙이나 바닥이 마른지 확인해 주세요.'
    );
  }

  if (safeLightInfo && isSunOrLightQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeLightInfo,
      '잎이 뜨겁거나 축 처지지 않는지도 같이 봐 주세요.'
    );
  }

  if (safeEnvironmentInfo && isPlaceOrSeasonQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeEnvironmentInfo,
      '오늘 자리의 빛, 온도, 바람을 함께 살펴봐 주세요.'
    );
  }

  if (safeLifecycleInfo && isLifecycleQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeLifecycleInfo,
      '잎 색, 줄기 힘, 새 잎 변화를 기록하면 더 잘 알 수 있어요.'
    );
  }

  if (safeSmellInfo && isSmellQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeSmellInfo,
      '잎이나 꽃을 비비거나 먹지는 말고 선생님과 함께 확인해요.'
    );
  }

  if (safeFavoriteInfo && isFavoriteQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeFavoriteInfo,
      '오늘은 그 조건이 잘 맞는지 잎과 흙을 살펴봐 주세요.'
    );
  }

  if (safeDislikeInfo && isDislikeQuestion(question)) {
    return makeTeacherInfoAnswer(
      safeDislikeInfo,
      '오늘 그런 모습이 있는지 사진이나 기록으로 남겨 주세요.'
    );
  }

  if (isHelpingPainQuestion(question)) {
    return '먼저 잎 색, 줄기 힘, 흙 느낌을 차례로 살펴봐 주세요. 물이 너무 많거나 부족하지 않은지 보고, 걱정되는 모습은 사진으로 남겨 선생님께 알려 주세요.';
  }

  if (
    isBarleySproutPlant(plantName, plantType) &&
    isRegrowthAfterHarvestQuestion(question)
  ) {
    return '보리새싹은 자른 뒤에 조금 다시 올라올 수 있지만, 처음처럼 튼튼하게 자라지 않을 수도 있어요. 먹기 전에는 선생님이 깨끗한지 확인하고, 남은 뿌리와 바닥 물도 함께 살펴봐 주세요.';
  }

  if (
    normalizePlantText(`${plantName} ${plantType}`).includes('콩') &&
    isRegrowthAfterHarvestQuestion(question)
  ) {
    return '먹은 콩은 다시 자라지 않아요. 대신 건강한 씨앗을 흙에 심으면 새 강낭콩으로 자랄 수 있어요. 교실에서는 먹기보다 꼬투리와 씨앗이 어떻게 변하는지 관찰해 봐요.';
  }

  if (isBarleySproutPlant(plantName, plantType) && isEdibleTimingQuestion(question)) {
    return '보리새싹은 보통 씨앗을 뿌린 뒤 7일에서 10일쯤, 키가 10cm에서 15cm 정도 되고 초록색이 선명할 때 먹는 경우가 많아요. 교실에서는 먹기 전에 선생님이 위생과 곰팡이 냄새가 없는지 꼭 확인해 주세요.';
  }

  return null;
}

async function generateChatAnswer(context, openAiApiKey) {
  const openai = getOpenAIClient(openAiApiKey);
  const model = process.env.OPENAI_CHAT_ANSWER_MODEL || DEFAULT_CHAT_ANSWER_MODEL;

  const response = await withTimeout(
    openai.responses.create({
      model,
      input: buildChatAnswerPrompt(context),
    }),
    CHAT_ANSWER_TIMEOUT_MS,
    'Chat answer request'
  );

  return sanitizeChatAnswer(response.output_text, context.fallbackAnswer);
}

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generatePlantInfoDraftOnce(plantType, model, openAiApiKey) {
  const openai = getOpenAIClient(openAiApiKey);

  const response = await withTimeout(
    openai.responses.create({
      model,
      input: buildPlantInfoDraftPrompt(plantType),
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
    PLANT_INFO_TIMEOUT_MS,
    'Plant info draft request'
  );

  return parsePlantInfoDraftJson(response.output_text);
}

async function generatePlantInfoDraft(plantType, openAiApiKey) {
  const models = getPlantInfoModels();
  const errors = [];

  for (const model of models) {
    for (let attempt = 1; attempt <= PLANT_INFO_RETRY_COUNT; attempt += 1) {
      try {
        return await generatePlantInfoDraftOnce(plantType, model, openAiApiKey);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown OpenAI error';

        errors.push(`${model} attempt ${attempt}: ${message}`);

        if (attempt < PLANT_INFO_RETRY_COUNT) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 600));
        }
      }
    }
  }

  throw new Error(errors.join(' | '));
}

function getTtsCacheFilePath(cacheKey) {
  const fileName = createHash('sha256').update(cacheKey).digest('hex');
  return path.join(ttsCacheDir, `${fileName}.mp3`);
}

async function readTtsAudioBase64FromDisk(cacheKey) {
  try {
    const filePath = getTtsCacheFilePath(cacheKey);
    const buffer = await readFile(filePath);
    return buffer.toString('base64');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeTtsAudioBufferToDisk(cacheKey, buffer) {
  await mkdir(ttsCacheDir, { recursive: true });
  await writeFile(getTtsCacheFilePath(cacheKey), buffer);
}

async function generateTtsAudioBuffer(text, openAiApiKey) {
  const openai = getOpenAIClient(openAiApiKey);

  const response = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'marin',
    input: text,
    instructions: buildTtsInstructions(),
  });

  return Buffer.from(await response.arrayBuffer());
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'TTS server is running',
    database: dbPath,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    requiresTestAccessCode: getTestAccessCodes().length > 0,
    testAvailability: getTestAvailability(),
    usage: getUsageSnapshot(),
  });
});

app.get('/api/state', (req, res) => {
  if (!requireTestAccess(req, res)) return;

  try {
    res.json({
      ok: true,
      state: getAppState(getRequestGroupId(req)),
    });
  } catch (error) {
    console.error('DB read error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to read app state';

    res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.put('/api/state', (req, res) => {
  if (!requireTestAccess(req, res)) return;

  try {
    const nextState = saveAppState(req.body?.state ?? {}, getRequestGroupId(req));

    res.json({
      ok: true,
      state: nextState,
    });
  } catch (error) {
    console.error('DB write error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to save app state';

    res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.post('/api/state/reset', (req, res) => {
  if (!requireTestAccess(req, res)) return;

  try {
    res.json({
      ok: true,
      state: resetAppState(getRequestGroupId(req)),
    });
  } catch (error) {
    console.error('DB reset error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to reset app state';

    res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.post('/api/plant-info-draft', async (req, res) => {
  if (!requireTestAccess(req, res)) return;

  const { plantType } = req.body ?? {};

  if (!plantType || typeof plantType !== 'string' || !plantType.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'plantType is required',
    });
  }

  const normalizedPlantType = plantType.trim();
  const cacheKey = normalizedPlantType.toLowerCase();
  const localDraft = findLocalPlantInfoDraft(normalizedPlantType);
  const requestApiKey = getRequestOpenAiApiKey(req);

  if (localDraft) {
    return res.json({
      ok: true,
      source: 'local',
      draft: createFallbackPlantInfoDraft(normalizedPlantType),
    });
  }

  if (plantInfoDraftCache.has(cacheKey)) {
    return res.json({
      ok: true,
      source: 'ai-cache',
      draft: plantInfoDraftCache.get(cacheKey),
    });
  }

  const gate = checkApiGate('draft');

  if (!gate.ok) {
    return res.json({
      ok: true,
      source: 'limit-fallback',
      draft: createFallbackPlantInfoDraft(normalizedPlantType),
      warning: gate.message,
      code: gate.code,
      count: gate.count,
      limit: gate.limit,
      deadline: gate.deadline,
    });
  }

  incrementUsage('draft');

  try {
    const rawDraft = await generatePlantInfoDraft(normalizedPlantType, requestApiKey);
    const draft = sanitizePlantInfoDraft(rawDraft, normalizedPlantType);

    plantInfoDraftCache.set(cacheKey, draft);

    return res.json({
      ok: true,
      source: 'ai',
      draft,
    });
  } catch (error) {
    console.error('Plant info draft error:', error);

    return res.json({
      ok: true,
      source: 'safe-fallback',
      draft: createFallbackPlantInfoDraft(normalizedPlantType),
      warning:
        error instanceof Error
          ? error.message
          : 'failed to generate plant info draft',
    });
  }
});

app.post('/api/photo-analysis', async (req, res) => {
  if (!requireTestAccess(req, res)) return;

  const { plantName, plantType, imageData } = req.body ?? {};

  if (!imageData || typeof imageData !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'imageData is required',
    });
  }

  if (!imageData.startsWith('data:image/')) {
    return res.status(400).json({
      ok: false,
      error: 'imageData must be a data URL',
    });
  }

  const safePlantName =
    typeof plantName === 'string' && plantName.trim()
      ? plantName.trim()
      : '이 식물';
  const safePlantType =
    typeof plantType === 'string' && plantType.trim()
      ? plantType.trim()
      : '종류를 아직 모르는 식물';
  const cacheKey = `${PHOTO_ANALYSIS_STYLE_VERSION}:${safePlantName}:${safePlantType}:${imageData.length}:${imageData.slice(-256)}`;
  const requestApiKey = getRequestOpenAiApiKey(req);

  if (photoAnalysisCache.has(cacheKey)) {
    return res.json({
      ok: true,
      source: 'ai-cache',
      analysis: photoAnalysisCache.get(cacheKey),
    });
  }

  const gate = checkApiGate('photo');

  if (!gate.ok) {
    return res.json({
      ok: true,
      source: 'limit-fallback',
      analysis: sanitizePhotoAnalysis({
        isPlantPhoto: false,
        visibleDetails: '오늘 AI 사진 확인은 여기까지예요.',
        uncertainDetails: '사진 분석은 내일 다시 할 수 있어요.',
        summary: '오늘 AI 사진 확인 사용량을 모두 썼어요.',
        leafHint: '선생님과 함께 잎 색과 모양을 눈으로 확인해 주세요.',
        soilHint: '흙이나 바닥은 직접 살짝 확인해 주세요.',
        action: '사진은 저장해 두고, 내일 AI 확인을 다시 눌러 주세요.',
      }),
      warning: gate.message,
      code: gate.code,
      count: gate.count,
      limit: gate.limit,
      deadline: gate.deadline,
    });
  }

  incrementUsage('photo');

  try {
    const analysis = await generatePhotoAnalysis({
      plantName: safePlantName,
      plantType: safePlantType,
      imageData,
      openAiApiKey: requestApiKey,
    });

    photoAnalysisCache.set(cacheKey, analysis);

    return res.json({
      ok: true,
      source: 'ai',
      analysis,
    });
  } catch (error) {
    console.error('Photo analysis error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to analyze photo';

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.post('/api/chat-answer', async (req, res) => {
  if (!requireTestAccess(req, res)) return;

  const {
    question,
    fallbackAnswer,
    plantName,
    plantType,
    teacherInfo,
    careState,
    recentRecords,
    latestPhotoAnalysis,
  } = req.body ?? {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'question is required',
    });
  }

  const safeFallback =
    typeof fallbackAnswer === 'string' && fallbackAnswer.trim()
      ? fallbackAnswer.trim()
      : '나는 식물 이야기만 대답할 수 있어요. 내 잎, 흙, 물, 햇빛에 대해 물어봐 주세요.';

  if (!isPlantChatScope(question)) {
    return res.json({
      ok: true,
      source: 'scope-fallback',
      answer:
        '나는 식물 이야기만 대답할 수 있어요. 내 잎, 흙, 물, 햇빛에 대해 물어봐 주세요.',
    });
  }

  const safePlantName =
    typeof plantName === 'string' && plantName.trim()
      ? plantName.trim()
      : '이 식물';
  const safePlantType =
    typeof plantType === 'string' && plantType.trim()
      ? plantType.trim()
      : '종류를 아직 모르는 식물';
  const requestApiKey = getRequestOpenAiApiKey(req);
  const localAnswer = createLocalChatAnswer({
    question,
    plantName: safePlantName,
    plantType: safePlantType,
    teacherInfo,
  });

  if (localAnswer) {
    return res.json({
      ok: true,
      source: 'local',
      answer: localAnswer,
    });
  }

  const gate = checkApiGate('chat');

  if (!gate.ok) {
    return res.json({
      ok: true,
      source: 'limit-fallback',
      answer: gate.message,
      code: gate.code,
      count: gate.count,
      limit: gate.limit,
      deadline: gate.deadline,
    });
  }

  incrementUsage('chat');

  try {
    const answer = await generateChatAnswer(
      {
        question: question.trim(),
        fallbackAnswer: safeFallback,
        plantName: safePlantName,
        plantType: safePlantType,
        teacherInfo,
        careState,
        recentRecords: Array.isArray(recentRecords) ? recentRecords.slice(-8) : [],
        latestPhotoAnalysis,
      },
      requestApiKey
    );

    return res.json({
      ok: true,
      source: 'ai',
      answer,
    });
  } catch (error) {
    console.error('Chat answer error:', error);

    return res.json({
      ok: true,
      source: 'safe-fallback',
      answer: safeFallback,
      warning:
        error instanceof Error ? error.message : 'failed to generate chat answer',
    });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    if (!requireTestAccess(req, res)) return;

    const { text } = req.body ?? {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'text is required',
      });
    }

    const normalizedText = text.trim();

    if (!normalizedText) {
      return res.status(400).json({
        ok: false,
        error: 'text is empty',
      });
    }

    const cacheKey = `${TTS_STYLE_VERSION}:${normalizedText}`;

    if (ttsCache.has(cacheKey)) {
      return res.json({
        ok: true,
        mockMode: false,
        cached: true,
        cacheSource: 'memory',
        audioBase64: ttsCache.get(cacheKey),
      });
    }

    const diskCachedAudioBase64 = await readTtsAudioBase64FromDisk(cacheKey);

    if (diskCachedAudioBase64) {
      ttsCache.set(cacheKey, diskCachedAudioBase64);

      return res.json({
        ok: true,
        mockMode: false,
        cached: true,
        cacheSource: 'disk',
        audioBase64: diskCachedAudioBase64,
      });
    }

    const gate = checkApiGate('tts');

    if (!gate.ok) {
      return sendApiGateResponse(res, gate);
    }

    incrementUsage('tts');

    const requestApiKey = getRequestOpenAiApiKey(req);
    const audioBuffer = await generateTtsAudioBuffer(normalizedText, requestApiKey);
    const audioBase64 = audioBuffer.toString('base64');

    await writeTtsAudioBufferToDisk(cacheKey, audioBuffer);

    ttsCache.set(cacheKey, audioBase64);

    return res.json({
      ok: true,
      mockMode: false,
      cached: false,
      cacheSource: 'openai',
      audioBase64,
    });
  } catch (error) {
    console.error('TTS error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to generate speech';

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`TTS server listening on http://localhost:${PORT}`);
});
