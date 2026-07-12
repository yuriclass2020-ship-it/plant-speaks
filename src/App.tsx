import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import { plantSpeciesPresets } from "./data/plantSpeciesPresets";
import type { PlantSpeciesKey, PlantSpeciesPreset } from "./types/plantSpecies";

type Screen =
  | "start"
  | "home"
  | "observe"
  | "care"
  | "record"
  | "analysis"
  | "chat"
  | "answerTest"
  | "register"
  | "leafRecord"
  | "soilRecord"
  | "photoRecord";

type Plant = {
  name: string;
  type: string;
  memo: string;
  teacherInfo?: TeacherPlantInfo;
};

type TeacherPlantInfo = {
  summary: string;
  originInfo?: string;
  classificationInfo?: string;
  nameStoryInfo?: string;
  edibleInfo: string;
  flowerInfo: string;
  fruitInfo: string;
  observationPoints: string;
  caution: string;
  growthInfo?: string;
  careInfo?: string;
  lightInfo?: string;
  environmentInfo?: string;
  lifecycleInfo?: string;
  smellInfo?: string;
  favoriteInfo?: string;
  dislikeInfo?: string;
  recommendedWaterIntervalDays?: number;
  recommendedSunGoal?: number;
  careChecklist?: string;
  childAnswerHints?: string;
  confirmedAt: string;
};

type CareState = {
  waterGoal: number;
  sunGoal: number;
  waterCount: number;
  sunCount: number;
  waterIntervalDays: number;
  lastWateredDateKey: string;
  countDateKey: string;
};

type ObservationType = "leaf" | "soil" | "photo" | "other";

type ObservationRecord = {
  id: string;
  childName?: string;
  plantName?: string;
  plantType?: string;
  type: ObservationType;
  title: string;
  date: string;
  dateKey: string;
  firstLabel: string;
  firstValue: string;
  firstIcon: string;
  secondLabel: string;
  secondValue: string;
  secondIcon: string;
  memo: string;
  imageData?: string;
  photoAnalysis?: PhotoAnalysis;
};

type AttentionRecord = {
  record: ObservationRecord;
  reason: string;
  action: string;
  icon: string;
};

type PhotoAnalysis = {
  isPlantPhoto?: boolean;
  visibleDetails?: string;
  uncertainDetails?: string;
  summary: string;
  leafHint: string;
  soilHint: string;
  action: string;
  checkedAt: string;
};

type NavItem = {
  screen: "home" | "observe" | "care" | "record";
  label: string;
  icon: string;
};

type FeatureCard = {
  title: string;
  desc: string;
  icon: string;
  action: () => void;
};

type ChoiceOption = {
  label: string;
  icon: string;
  color: string;
};

type ChatMessage = {
  id: string;
  childName?: string;
  question: string;
  answer: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
    isFinal?: boolean;
    length: number;
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type DraftStatus = {
  tone: "idle" | "loading" | "success" | "warning" | "error";
  text: string;
};

const CARE_STORAGE_KEY = "plant-speaks-care-state-v1";
const PLANT_STORAGE_KEY = "plant-speaks-plant-v1";
const RECORD_STORAGE_KEY = "plant-speaks-observation-records-v1";
const CHAT_STORAGE_KEY = "plant-speaks-chat-messages-v1";
const CHILD_STORAGE_KEY = "plant-speaks-current-child-v1";
const CHILD_ROSTER_STORAGE_KEY = "plant-speaks-child-roster-v1";
const TEST_ACCESS_CODE_STORAGE_KEY = "plant-speaks-test-access-code-v1";
const AI_CHAT_CACHE_STORAGE_KEY = "plant-speaks-ai-chat-cache-v3";
const AI_CHAT_USAGE_STORAGE_KEY = "plant-speaks-ai-chat-usage-v1";
const MAX_CHAT_MESSAGES = 80;
const MAX_AI_CHAT_CACHE_ENTRIES = 160;
const DAILY_AI_CHAT_LIMIT = 30;
const API_STATE_URL = "/api/state";
const API_PLANT_INFO_DRAFT_URL = "/api/plant-info-draft";
const API_TTS_URL = "/api/tts";
const API_PHOTO_ANALYSIS_URL = "/api/photo-analysis";
const API_CHAT_ANSWER_URL = "/api/chat-answer";
const OPENAI_API_KEY_STORAGE_KEY = "plant-speaks-openai-api-key";
const CARE_REACTION_SPEECH: Record<"waterCount" | "sunCount", string> = {
  waterCount: "고마워. 시원해!",
  sunCount: "따뜻해. 고마워!",
};

const QUICK_CHAT_QUESTIONS = [
  "물을 언제 줘?",
  "잎이 왜 시들었어?",
  "햇빛을 좋아해?",
  "지금 아파?",
  "먹을 수 있어?",
  "꽃도 펴?",
];

function getTestAccessHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

function getApiHeaders(openAiApiKey?: string): HeadersInit {
  const headers: HeadersInit = { ...getTestAccessHeaders() };

  if (openAiApiKey?.trim()) {
    headers["x-openai-api-key"] = openAiApiKey.trim();
  }

  return headers;
}

function clearTestAccessCodeIfNeeded(response: Response) {
  if (response.status === 401 && typeof window !== "undefined") {
    window.localStorage.removeItem(TEST_ACCESS_CODE_STORAGE_KEY);
  }
}

const defaultCareState: CareState = {
  waterGoal: 1,
  sunGoal: 1,
  waterCount: 0,
  sunCount: 0,
  waterIntervalDays: 2,
  lastWateredDateKey: "",
  countDateKey: "",
};

type DbAppState = {
  plant: Plant | null;
  careState: CareState;
  records: ObservationRecord[];
  chatMessages?: ChatMessage[];
  childRoster?: string[];
  currentChildName?: string;
};

type AiChatUsage = {
  dateKey: string;
  count: number;
};

function normalizeCareState(
  careState: Partial<CareState> | undefined,
  fallbackDateKey: string
): CareState {
  return {
    waterGoal: careState?.waterGoal || defaultCareState.waterGoal,
    sunGoal: careState?.sunGoal || defaultCareState.sunGoal,
    waterCount: careState?.waterCount || defaultCareState.waterCount,
    sunCount: careState?.sunCount || defaultCareState.sunCount,
    waterIntervalDays:
      careState?.waterIntervalDays || defaultCareState.waterIntervalDays,
    lastWateredDateKey: careState?.lastWateredDateKey || "",
    countDateKey: careState?.countDateKey || fallbackDateKey,
  };
}

function mergeRecordsWithLocalMetadata(
  dbRecords: ObservationRecord[],
  localRecords: ObservationRecord[]
) {
  const localRecordMap = new Map(
    localRecords.map((record) => [record.id, record])
  );
  const mergedRecordIds = new Set(dbRecords.map((record) => record.id));
  const mergedRecords = dbRecords.map((record) => {
    const localRecord = localRecordMap.get(record.id);

    if (!localRecord) return record;

    return {
      ...record,
      childName: record.childName ?? localRecord.childName,
      plantName: record.plantName ?? localRecord.plantName,
      plantType: record.plantType ?? localRecord.plantType,
      imageData: record.imageData ?? localRecord.imageData,
      photoAnalysis: record.photoAnalysis ?? localRecord.photoAnalysis,
    };
  });

  return [
    ...mergedRecords,
    ...localRecords.filter((record) => !mergedRecordIds.has(record.id)),
  ];
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return fallback;

  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

function createCareStateFromTeacherInfo(
  teacherInfo: TeacherPlantInfo | undefined,
  fallbackDateKey: string
): CareState {
  return {
    ...defaultCareState,
    sunGoal: clampNumber(
      teacherInfo?.recommendedSunGoal,
      defaultCareState.sunGoal,
      1,
      5
    ),
    waterIntervalDays: clampNumber(
      teacherInfo?.recommendedWaterIntervalDays,
      defaultCareState.waterIntervalDays,
      1,
      14
    ),
    countDateKey: fallbackDateKey,
  };
}

async function loadStateFromDb(): Promise<DbAppState | null> {
  const response = await fetch(API_STATE_URL, {
    headers: getTestAccessHeaders(),
  });
  const data = (await response.json()) as {
    ok: boolean;
    state?: DbAppState;
  };

  clearTestAccessCodeIfNeeded(response);

  if (!response.ok || !data.ok || !data.state) {
    return null;
  }

  return data.state;
}

async function saveStateToDb(state: DbAppState) {
  const response = await fetch(API_STATE_URL, {
    method: "PUT",
    headers: getTestAccessHeaders(),
    body: JSON.stringify({ state }),
  });
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;

  clearTestAccessCodeIfNeeded(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "저장하지 못했어요.");
  }
}

async function loadPlantInfoDraftFromServer(
  plantType: string,
  openAiApiKey?: string
): Promise<{
  draft: TeacherPlantInfo;
  source?: string;
  warning?: string;
} | null> {
  const response = await fetch(API_PLANT_INFO_DRAFT_URL, {
    method: "POST",
    headers: getApiHeaders(openAiApiKey),
    body: JSON.stringify({ plantType }),
  });
  const data = (await response.json()) as {
    ok: boolean;
    source?: string;
    draft?: TeacherPlantInfo;
    warning?: string;
  };

  clearTestAccessCodeIfNeeded(response);

  if (!response.ok || !data.ok || !data.draft) {
    return null;
  }

  return {
    draft: data.draft,
    source: data.source,
    warning: data.warning,
  };
}

async function loadPhotoAnalysisFromServer({
  plantName,
  plantType,
  imageData,
  openAiApiKey,
}: {
  plantName: string;
  plantType: string;
  imageData: string;
  openAiApiKey?: string;
}): Promise<PhotoAnalysis> {
  const response = await fetch(API_PHOTO_ANALYSIS_URL, {
    method: "POST",
    headers: getApiHeaders(openAiApiKey),
    body: JSON.stringify({ plantName, plantType, imageData }),
  });
  const data = (await response.json()) as {
    ok: boolean;
    analysis?: PhotoAnalysis;
    error?: string;
  };

  clearTestAccessCodeIfNeeded(response);

  if (!response.ok || !data.ok || !data.analysis) {
    throw new Error(data.error || "사진을 살펴보지 못했어요.");
  }

  return data.analysis;
}

async function loadChatAnswerFromServer({
  question,
  fallbackAnswer,
  plantName,
  plantType,
  teacherInfo,
  careState,
  recentRecords,
  latestPhotoAnalysis,
  openAiApiKey,
}: {
  question: string;
  fallbackAnswer: string;
  plantName: string;
  plantType: string;
  teacherInfo?: TeacherPlantInfo;
  careState: CareState;
  recentRecords: ObservationRecord[];
  latestPhotoAnalysis?: PhotoAnalysis;
  openAiApiKey?: string;
}): Promise<string> {
  const response = await fetch(API_CHAT_ANSWER_URL, {
    method: "POST",
    headers: getApiHeaders(openAiApiKey),
    body: JSON.stringify({
      question,
      fallbackAnswer,
      plantName,
      plantType,
      teacherInfo,
      careState,
      recentRecords: recentRecords.map((record) => ({
        type: record.type,
        title: record.title,
        date: record.date,
        memo: record.memo,
        photoAnalysis: record.photoAnalysis
          ? {
              summary: record.photoAnalysis.summary,
              visibleDetails: record.photoAnalysis.visibleDetails,
              uncertainDetails: record.photoAnalysis.uncertainDetails,
              action: record.photoAnalysis.action,
            }
          : undefined,
      })),
      latestPhotoAnalysis,
    }),
  });
  const data = (await response.json()) as {
    ok: boolean;
    answer?: string;
    error?: string;
  };

  clearTestAccessCodeIfNeeded(response);

  if (!response.ok || !data.ok || !data.answer) {
    throw new Error(data.error || "AI 답변을 만들지 못했어요.");
  }

  return data.answer;
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(year, month - 1, day));
}

function getDaysBetweenDateKeys(fromDateKey: string, toDateKey: string) {
  const [fromYear, fromMonth, fromDay] = fromDateKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDateKey.split("-").map(Number);

  if (!fromYear || !fromMonth || !fromDay || !toYear || !toMonth || !toDay) {
    return 0;
  }

  const fromDate = new Date(fromYear, fromMonth - 1, fromDay);
  const toDate = new Date(toYear, toMonth - 1, toDay);
  const oneDay = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.floor((toDate.getTime() - fromDate.getTime()) / oneDay));
}

function getLatestRecord(records: ObservationRecord[], type?: ObservationType) {
  const filteredRecords = type
    ? records.filter((record) => record.type === type)
    : records;

  return filteredRecords.reduce<ObservationRecord | null>((latest, record) => {
    if (!latest) return record;
    return record.dateKey > latest.dateKey ? record : latest;
  }, null);
}

const plantSpeciesAliases: Record<PlantSpeciesKey, string[]> = {
  lettuce: ["상추"],
  balsam: ["봉선화"],
  tomato: ["방울토마토", "토마토", "tomato"],
  kidneyBean: ["강낭콩", "콩"],
  scindapsus: ["스킨답서스", "스킨", "스킨답서스"],
};

const extraTeacherInfoDrafts: Array<{
  names: string[];
  info: Omit<TeacherPlantInfo, "confirmedAt">;
}> = [
  {
    names: ["보리새싹", "보리 싹", "보리", "barley sprout", "barley grass"],
    info: {
      summary:
        "보리새싹은 씨앗에서 싹이 빠르게 올라오고 초록 잎이 자라는 모습을 관찰하기 좋은 식물이에요. 키, 잎 색, 잎 수, 기울기 변화를 매일 비교해 볼 수 있어요.",
      edibleInfo:
        "보리새싹은 보통 어린잎을 먹을 수 있는 식물로 알려져 있어요. 씨앗을 뿌린 뒤 7일에서 10일 정도 지나 잎이 10cm에서 15cm쯤 자라고 초록색이 선명할 때 수확해 먹는 경우가 많아요. 깨끗하게 자란 새싹을 잘라 씻은 뒤 샐러드에 조금 곁들이거나 주스로 갈아 먹는 예가 있어요. 다만 교실에서 먹기 전에는 씨앗과 흙, 물, 위생 상태를 선생님이나 어른이 꼭 먼저 확인해야 해요.",
      flowerInfo:
        "교실에서 짧게 키우는 보리새싹은 보통 꽃보다 새싹과 잎 자람을 관찰해요. 오래 키우면 이삭이 생길 수 있지만 새싹 관찰에서는 드물어요.",
      fruitInfo:
        "보리새싹 활동에서는 열매보다 씨앗에서 싹이 나고 잎이 자라는 과정을 관찰해요. 오래 자라면 이삭과 낟알이 생길 수 있어요.",
      observationPoints:
        "싹이 난 날, 키, 잎 색, 잎 수, 줄기 기울기, 뿌리, 흙 또는 키친타월의 촉촉함",
      caution:
        "먹기 전에는 반드시 선생님이나 어른이 확인해요. 곰팡이가 보이거나 냄새가 이상하거나 흙과 물 위생이 확실하지 않으면 먹지 않아요.",
      growthInfo:
        "보리새싹은 빠르게 자라며 며칠 사이에 키가 달라지는 모습을 볼 수 있어요. 매일 같은 자리에서 사진을 찍고 키를 비교하면 좋아요.",
      careInfo:
        "마르지 않게 촉촉하게 유지하되 물이 고이지 않게 해요. 밝은 곳에 두고 잎이 누렇게 변하거나 쓰러지는지 살펴봐요.",
      lightInfo:
        "싹이 올라온 뒤에는 밝은 빛을 받으면 잎이 초록색으로 변해요. 너무 뜨거운 직사광선은 피하고 밝은 곳에서 관찰해요.",
      environmentInfo:
        "따뜻하고 밝은 실내에서 잘 자라요. 너무 춥거나 물이 부족하면 자람이 느려질 수 있어요.",
      lifecycleInfo:
        "새싹 관찰은 보통 1주에서 2주 정도가 알맞아요. 시간이 지나면 잎이 길어지고 쓰러지거나 누렇게 변할 수 있어요.",
      smellInfo:
        "신선할 때는 풀 냄새가 날 수 있어요. 시큼하거나 곰팡이 냄새가 나면 먹지 않고 선생님에게 알려요.",
      favoriteInfo:
        "따뜻한 실내, 밝은 빛, 촉촉하지만 고이지 않는 물을 좋아해요.",
      dislikeInfo:
        "물이 고이는 것, 너무 마르는 것, 곰팡이가 생기는 환경을 힘들어해요.",
      recommendedWaterIntervalDays: 1,
      recommendedSunGoal: 1,
      careChecklist:
        "매일 촉촉한지 보기, 물이 고였는지 확인하기, 키와 잎 색 비교하기, 곰팡이나 이상한 냄새 확인하기",
      childAnswerHints:
        "먹는 질문에는 7일에서 10일쯤, 10cm에서 15cm 정도 자랐을 때를 안내하되 먹기 전 선생님 확인과 위생 확인을 꼭 말해요.",
    },
  },
  {
    names: ["바질", "basil"],
    info: {
      summary:
        "바질은 향이 나는 잎을 관찰하기 좋은 허브 식물이에요. 잎 색, 잎 냄새, 새 잎이 나는 모습을 살펴볼 수 있어요.",
      edibleInfo:
        "바질은 보통 잎을 먹는 허브로 알려져 있어요. 잎을 깨끗이 씻어 샐러드나 토마토 요리에 조금 넣거나 향을 내는 데 쓰는 예가 있어요. 그래도 교실 식물은 먹기 전에 꼭 선생님이나 어른이 종류와 위생 상태를 먼저 확인해야 해요.",
      flowerInfo:
        "바질은 자라면 줄기 끝에 작은 꽃이 필 수 있어요. 꽃이 보이면 잎과 줄기 끝 변화를 함께 관찰해요.",
      fruitInfo:
        "바질은 열매보다 잎과 꽃, 씨앗 변화를 관찰하는 식물로 보는 게 좋아요.",
      observationPoints: "잎 색, 잎 냄새, 새 잎, 줄기 끝, 흙 상태",
      caution: "선생님 확인 전에는 잎을 따거나 먹지 않아요.",
    },
  },
  {
    names: ["민트", "애플민트", "스피어민트", "mint"],
    info: {
      summary:
        "민트는 향이 강한 잎과 줄기 변화를 관찰하기 좋은 허브 식물이에요.",
      edibleInfo:
        "민트는 보통 잎을 먹거나 향을 맡는 허브로 알려져 있어요. 깨끗이 씻은 잎을 차에 우려 향을 내거나 음료, 과일에 조금 곁들이는 예가 있어요. 먹기 전에는 꼭 선생님이나 어른이 종류와 위생 상태를 먼저 확인해야 해요.",
      flowerInfo:
        "민트는 자라면 작은 꽃이 필 수 있어요. 줄기 끝과 잎 사이를 살펴봐요.",
      fruitInfo:
        "민트는 열매보다 잎, 줄기, 꽃 변화를 관찰하는 식물로 보는 게 좋아요.",
      observationPoints: "잎 냄새, 잎 색, 줄기 길이, 새 잎, 흙 상태",
      caution: "확인 전에는 잎을 따거나 입에 넣지 않아요.",
    },
  },
  {
    names: ["해바라기", "sunflower"],
    info: {
      summary:
        "해바라기는 키가 자라고 큰 꽃이 피는 과정을 관찰하기 좋은 식물이에요.",
      edibleInfo:
        "해바라기는 씨앗을 먹는 식물로 알려져 있지만, 씨앗이 충분히 여물고 깨끗하게 말랐는지 확인해야 해요. 볶거나 껍질을 벗겨 먹는 예가 있지만, 교실에서 기른 식물은 먹기 전 선생님이나 어른 확인이 필요해요.",
      flowerInfo:
        "해바라기는 잘 자라면 큰 노란 꽃을 피울 수 있어요. 꽃봉오리와 줄기 높이를 함께 관찰해요.",
      fruitInfo:
        "해바라기는 꽃이 진 뒤 씨앗이 생길 수 있어요. 씨앗이 생기는 과정은 천천히 관찰해요.",
      observationPoints: "줄기 높이, 잎 크기, 꽃봉오리, 꽃 색, 씨앗",
      caution: "씨앗이나 잎을 먹기 전에는 꼭 선생님이나 어른과 확인해요.",
    },
  },
  {
    names: ["고추", "pepper", "chili"],
    info: {
      summary:
        "고추는 꽃이 피고 열매 색이 변하는 모습을 관찰하기 좋은 식물이에요.",
      edibleInfo:
        "고추는 보통 열매를 먹는 식물로 알려져 있지만 매울 수 있어요. 익은 열매를 깨끗이 씻어 음식에 아주 조금 넣어 맛을 내는 예가 있어요. 먹기 전에는 꼭 선생님이나 어른이 매운 정도와 위생 상태를 확인해야 해요.",
      flowerInfo:
        "고추는 자라면 작은 꽃이 필 수 있고, 꽃 뒤에 열매가 생길 수 있어요.",
      fruitInfo:
        "고추는 꽃 뒤에 열매가 생기고, 열매 색이 초록색에서 빨간색 등으로 달라질 수 있어요.",
      observationPoints: "꽃, 열매, 열매 색, 잎 색, 흙 상태",
      caution: "고추 열매는 매울 수 있으니 손으로 만진 뒤 눈을 비비지 않고, 먹기 전에는 꼭 확인해요.",
    },
  },
  {
    names: ["딸기", "strawberry"],
    info: {
      summary:
        "딸기는 꽃과 열매가 자라는 과정을 관찰하기 좋은 식물이에요.",
      edibleInfo:
        "딸기는 보통 빨갛게 익은 열매를 먹는 식물로 알려져 있어요. 빨갛게 익은 열매를 깨끗이 씻어 그대로 먹거나 요거트에 곁들이는 예가 있어요. 먹기 전에는 꼭 선생님이나 어른이 깨끗한지, 먹어도 되는 상태인지 먼저 확인해야 해요.",
      flowerInfo:
        "딸기는 작은 꽃이 필 수 있고, 꽃 뒤에 열매가 생길 수 있어요.",
      fruitInfo:
        "딸기는 열매가 자라며 색이 초록색이나 흰빛에서 빨간색으로 달라질 수 있어요.",
      observationPoints: "꽃, 열매 크기, 열매 색, 잎 모양, 흙 상태",
      caution: "먹기 전에는 깨끗한지, 먹어도 되는 상태인지 선생님이나 어른과 확인해요.",
    },
  },
  {
    names: ["라벤더", "lavender"],
    info: {
      summary:
        "라벤더는 향이 나는 잎과 보라색 꽃을 관찰하기 좋은 허브 식물이에요. 잎 색, 줄기 길이, 향, 꽃봉오리 변화를 살펴볼 수 있어요.",
      edibleInfo:
        "라벤더는 향을 이용하는 허브로 알려져 있지만, 교실에서 기른 식물은 먹기 전에 꼭 선생님이나 어른이 먼저 확인해야 해요.",
      flowerInfo:
        "라벤더는 잘 자라면 줄기 끝에 보라색 작은 꽃이 모여 필 수 있어요. 꽃봉오리가 생기는지 관찰해요.",
      fruitInfo:
        "라벤더는 열매보다 잎, 줄기, 꽃, 씨앗 변화를 관찰하는 식물로 보는 게 좋아요.",
      observationPoints: "잎 색, 잎 향, 줄기 길이, 꽃봉오리, 흙 상태",
      caution:
        "향이 있어도 선생님 확인 전에는 잎이나 꽃을 먹지 않고, 향을 맡을 때도 너무 가까이 대지 않아요.",
    },
  },
];

function normalizePlantText(value: string) {
  return value.replace(/\s/g, "").toLowerCase();
}

function getSpeciesPresetFromPlantType(plantType: string): PlantSpeciesPreset | null {
  const normalizedPlantType = normalizePlantText(plantType);

  return (
    plantSpeciesPresets.find((preset) => {
      const names = [preset.label, ...plantSpeciesAliases[preset.key]];

      return names.some((name) => {
        const normalizedName = normalizePlantText(name);
        return (
          normalizedPlantType.includes(normalizedName) ||
          normalizedName.includes(normalizedPlantType)
        );
      });
    }) ?? null
  );
}

function getExtraTeacherInfoDraft(plantType: string) {
  const normalizedPlantType = normalizePlantText(plantType);

  return (
    extraTeacherInfoDrafts.find((draft) =>
      draft.names.some((name) => {
        const normalizedName = normalizePlantText(name);
        return (
          normalizedPlantType.includes(normalizedName) ||
          normalizedName.includes(normalizedPlantType)
        );
      })
    ) ?? null
  );
}

function createTeacherInfoDraft(plantType: string): TeacherPlantInfo {
  const preset = getSpeciesPresetFromPlantType(plantType);
  const now = new Date().toISOString();
  const genericDetails = {
    originInfo:
      "어디에서 처음 자라던 식물인지와 널리 키워진 지역은 식물마다 달라요. 정확한 원산지는 선생님이 확인해 주세요.",
    classificationInfo:
      "식물은 잎, 줄기, 꽃, 열매가 있는지에 따라 여러 무리로 나눌 수 있어요. 이 식물은 잎과 줄기 변화를 중심으로 관찰해요.",
    nameStoryInfo:
      "식물 이름은 모양, 향, 색, 처음 알려진 지역에서 온 경우가 많아요. 정확한 이름 유래는 선생님이 확인해 주세요.",
    growthInfo:
      "얼마나 자라는지는 식물 종류와 환경에 따라 달라요. 같은 자리에서 키, 줄기 길이, 잎 수를 기록하면 자라는 속도를 비교할 수 있어요.",
    careInfo:
      "흙이나 재배 바닥이 마른 정도, 잎이 축 처졌는지, 햇빛이 너무 뜨겁지 않은지를 함께 보며 돌봐요.",
    lightInfo:
      "대부분의 교실 식물은 밝지만 잎이 뜨거워지지 않는 자리를 먼저 확인해요. 잎이 뜨겁거나 축 처지면 자리를 바꿔 볼 수 있어요.",
    environmentInfo:
      "실내에서 키우는지, 바깥에서 키우는지와 계절 온도에 따라 지내는 모습이 달라요. 추위, 더위, 바람, 너무 강한 햇빛은 잎 상태로 확인해요.",
    lifecycleInfo:
      "식물이 얼마나 오래 사는지와 시드는 시기는 종류와 환경에 따라 달라요. 잎 색이 변하거나 줄기 힘이 약해지면 시드는 신호일 수 있어요.",
    smellInfo:
      "향이 나는지는 식물마다 달라요. 좋은 향도 있고 거의 냄새가 나지 않을 수도 있어요. 이상한 냄새가 나면 선생님께 알려요.",
    favoriteInfo:
      "알맞은 물, 밝지만 뜨겁지 않은 빛, 부드러운 관찰을 좋아해요. 잎과 흙이 편안해 보이면 잘 지내는 신호일 수 있어요.",
    dislikeInfo:
      "흙이 너무 마르거나 물이 고이는 것, 잎이 뜨거워지는 것, 꺾이거나 뽑히는 것을 힘들어해요. 잎이 축 처지거나 색이 변하면 확인이 필요해요.",
    recommendedWaterIntervalDays: 2,
    recommendedSunGoal: 1,
    careChecklist:
      "흙이 말랐는지 만져보기, 잎이 뜨겁거나 축 처졌는지 보기, 밝은 자리인지 확인하기",
    childAnswerHints:
      "먹기 질문은 선생님 확인을 먼저 말하고, 꽃/열매/색/수명 질문은 저장된 정보로 답한 뒤 오늘 관찰할 단서로 이어가요.",
  };

  if (preset) {
    return {
      summary: preset.basicInfo.description,
      edibleInfo: preset.speciesFacts.ediblePartInfo,
      flowerInfo: preset.speciesFacts.flowerExistence,
      fruitInfo: preset.speciesFacts.fruitExistence,
      observationPoints: preset.observationPoints.join(", "),
      caution:
        preset.edibleInfo.caution ??
        "먹거나 만지기 전에는 선생님이나 어른과 함께 확인해요.",
      growthInfo: `${preset.growthInfo.sizeHint} ${preset.growthInfo.growthTimeHint}`,
      careInfo: `${preset.care.watering} ${preset.care.sunlight}`,
      lightInfo: preset.care.sunlight,
      environmentInfo:
        "실내에서 키우는지, 바깥에서 키우는지와 계절 온도에 따라 지내는 모습이 달라요.",
      lifecycleInfo:
        "식물이 얼마나 오래 사는지와 시드는 시기는 종류와 환경에 따라 달라요. 잎 색과 줄기 힘을 관찰해요.",
      smellInfo:
        "향이 나는지는 식물마다 달라요. 잎이나 꽃을 비비지 말고 선생님과 함께 조심히 맡아봐요.",
      favoriteInfo: "알맞은 물, 밝은 빛, 조심스러운 관찰을 좋아해요.",
      dislikeInfo:
        "흙이 너무 마르거나 잎이 뜨거워지는 것, 꺾이거나 뽑히는 것을 힘들어해요.",
      recommendedWaterIntervalDays: 2,
      recommendedSunGoal: 1,
      careChecklist:
        "흙이 말랐는지 만져보기, 잎이 뜨겁거나 축 처졌는지 보기, 밝은 자리인지 확인하기",
      childAnswerHints:
        "아이 질문에는 먹기보다 관찰을 먼저 안내하고, 잎과 흙 상태를 살펴보도록 답해요.",
      confirmedAt: now,
    };
  }

  const extraDraft = getExtraTeacherInfoDraft(plantType);

  if (extraDraft) {
    return {
      ...genericDetails,
      ...extraDraft.info,
      confirmedAt: now,
    };
  }

  const safePlantType = plantType.trim() || "이 식물";

  return {
    summary: `${safePlantType}의 자세한 정보는 선생님이 확인해 주세요. 아이들에게는 잎, 줄기, 흙, 햇빛 변화를 중심으로 관찰하도록 안내할 수 있어요.`,
    edibleInfo:
      "먹을 수 있는지는 아직 확인되지 않았어요. 먹기 전에는 꼭 선생님이나 어른이 먼저 확인해야 해요.",
    flowerInfo:
      "꽃이 피는지는 식물마다 달라요. 줄기 끝이나 잎 사이에 작은 변화가 있는지 관찰해요.",
    fruitInfo:
      "열매나 씨앗이 생기는지는 식물마다 달라요. 꽃이 진 자리와 줄기 주변을 살펴봐요.",
    observationPoints: "잎 색, 잎 모양, 새 잎, 줄기, 흙 상태, 햇빛 위치",
    caution: "이 식물은 확인 전까지 입에 넣지 않고, 꺾거나 뽑지 않아요.",
    ...genericDetails,
    confirmedAt: now,
  };
}

function getObservationPointList(observationPoints: string) {
  return observationPoints
    .replace(/[.。]/g, ",")
    .replace(/\s*또\s*/g, ", ")
    .split(/[,，]/)
    .map((point) =>
      point
        .trim()
        .replace(
          /(을|를)?\s*(관찰해\s*보세요|관찰해요|살펴봐\s*주세요|살펴보세요|살펴봐요|체크해\s*보세요|체크해요|확인해\s*보세요|확인해요)$/g,
          ""
        )
        .replace(/(을|를)$/g, "")
        .trim()
    )
    .filter((point) => point && !/(보세요|체크|관찰|확인|얼마나)/.test(point))
    .slice(0, 3);
}

function getObservationHint(observationPoints: string) {
  const points = getObservationPointList(observationPoints);

  return points.length > 0 ? points.join(", ") : "잎 모양, 잎 색, 흙 상태";
}

function getObservationPrompt(observationPoints: string) {
  return `${getObservationHint(observationPoints)}를 살펴봐 주세요.`;
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function createEdibleAnswerText(edibleText: string, wantsMethod: boolean) {
  const sentences = edibleText
    .split(/[.!?。]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const safetySuffix =
    "교실에서는 먹기 전에 선생님이 정확한 종류와 위생 상태를 먼저 확인해 주세요.";
  const methodSentences = sentences.filter((sentence) =>
    includesAny(sentence, [
      "씻",
      "샐러드",
      "요리",
      "차에",
      "우려",
      "음료",
      "곁들이",
      "그대로",
      "주스",
      "갈아",
      "향",
      "조금 넣",
    ])
  );
  const infoSentences = sentences.filter(
    (sentence) =>
      !includesAny(sentence, ["반드시", "꼭", "확인", "위생", "안전"])
  );
  const baseSentences = wantsMethod
    ? methodSentences.length > 0
      ? methodSentences
      : []
    : infoSentences.length > 0
    ? infoSentences
    : sentences;
  const body = baseSentences.slice(0, 2).join(". ");

  if (wantsMethod && !body) {
    const ediblePart = includesAny(edibleText, ["잎"])
      ? "저장된 정보로는 먹을 수 있는 부위가 잎이라는 것만 확인돼요."
      : "저장된 정보에는 먹는 방법 예시가 아직 자세히 없어요.";

    return `${ediblePart} ${safetySuffix}`;
  }

  return `${body || edibleText} ${safetySuffix}`.replace(/\s+/g, " ").trim();
}

function getSafePhotoAnalysisText(value: string | undefined, fallback: string) {
  if (!value?.trim()) return fallback;

  const unsafeDiagnosisPattern =
    /(썩|썩어|썩은|부패|곰팡|병해|병든|병이|해충|벌레|감염|세균|바이러스|뿌리썩|줄기썩)/;

  if (!unsafeDiagnosisPattern.test(value)) return value.trim();

  const cleanedText = value
    .split(/[.!?。]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !unsafeDiagnosisPattern.test(sentence))
    .join(". ")
    .trim();

  return cleanedText || fallback;
}

function getPhotoAnalysisChildText(analysis?: PhotoAnalysis) {
  if (!analysis) {
    return "사진을 남겼어요. 선생님이 필요할 때 사진을 확인할 수 있어요.";
  }

  if (analysis.isPlantPhoto === false) {
    return "식물이 잘 보이지 않아요. 식물 전체와 잎이 보이게 다시 찍어봐요.";
  }

  const visibleText = getSafePhotoAnalysisText(
    analysis.visibleDetails || analysis.summary,
    "사진에서 보이는 점은 선생님과 다시 확인해요."
  );
  return `사진에서 보이는 점을 기록에 붙였어요. ${visibleText}`;
}

function getPhotoAnalysisAttention(record: ObservationRecord) {
  const analysis = record.photoAnalysis;
  if (!analysis) return null;

  if (analysis.isPlantPhoto === false) {
    return {
      reason: "식물 사진으로 확인되지 않았어요",
      action: analysis.action || "식물 전체, 잎, 흙이 보이게 다시 사진을 남겨 주세요.",
      icon: "/icons/camera.png",
    };
  }

  const analysisText = [
    analysis.visibleDetails,
    analysis.uncertainDetails,
    analysis.summary,
    analysis.leafHint,
    analysis.soilHint,
    analysis.action,
  ]
    .filter(Boolean)
    .join(" ");

  if (
    includesAny(analysisText, [
      "축 처",
      "처져",
      "말랐",
      "시들",
      "노란",
      "갈색",
      "구멍",
      "걱정",
      "돌봄",
      "다시 사진",
    ])
  ) {
    return {
      reason: getSafePhotoAnalysisText(
        analysis.visibleDetails || analysis.summary,
        "사진에서 걱정되는 점은 선생님과 다시 확인해요."
      ),
      action: getSafePhotoAnalysisText(
        analysis.action,
        "같은 자리에서 다시 사진을 남기고 잎과 흙을 확인해요."
      ),
      icon: record.secondIcon || record.firstIcon || "/icons/camera.png",
    };
  }

  return null;
}

function buildChildCurriculumReport(
  childName: string,
  childRecords: ObservationRecord[],
  childMessages: ChatMessage[]
) {
  const normalizedChildName = childName.trim() || "선택한 아이";
  const leafRecords = childRecords.filter((record) => record.type === "leaf");
  const soilRecords = childRecords.filter((record) => record.type === "soil");
  const photoRecords = childRecords.filter((record) => record.type === "photo");
  const latestRecords = [...childRecords].slice(-3).reverse();
  const latestQuestions = childMessages
    .map((message) => message.question.trim())
    .filter(Boolean)
    .slice(-3)
    .reverse();
  const latestPhotoAnalysis = [...photoRecords]
    .reverse()
    .find((record) => record.photoAnalysis)?.photoAnalysis;
  const questionText = childMessages
    .map((message) => message.question)
    .join(" ");
  const questionCount = childMessages.length;
  const inquiryQuestionCount = childMessages.filter((message) =>
    includesAny(message.question, ["왜", "언제", "어떻게", "얼마나", "며칠", "무엇"])
  ).length;
  const careQuestionCount = childMessages.filter((message) =>
    includesAny(message.question, ["물", "흙", "햇빛", "시들", "살", "키워", "돌"])
  ).length;
  const expressionCount = childRecords.filter(
    (record) => record.memo && record.memo !== "그림으로 기록했어요."
  ).length;
  const hasAffection = includesAny(questionText, [
    "사랑",
    "고마",
    "좋아",
    "건강",
    "잘자라",
  ]);
  const joinAnalysisText = (...parts: Array<string | false | null | undefined>) =>
    parts.filter((part): part is string => Boolean(part?.trim())).join(" ");

  const questionEvidence =
    latestQuestions.length > 0
      ? `최근 질문: "${latestQuestions.join('", "')}"`
      : "";
  const recordEvidence =
    latestRecords.length > 0
      ? `최근 기록: ${latestRecords
          .map((record) => `${record.title}(${record.date})`)
          .join(", ")}`
      : "";
  const photoEvidence = latestPhotoAnalysis
    ? `사진 분석에서는 "${latestPhotoAnalysis.summary}"라고 남아 있어요.`
    : "";
  const leafEvidence =
    leafRecords.length > 0
      ? `잎 기록에는 ${leafRecords
          .slice(-2)
          .map((record) => record.title)
          .join(", ")} 같은 표현이 있어요.`
      : "";
  const soilEvidence =
    soilRecords.length > 0
      ? `흙 기록에는 ${soilRecords
          .slice(-2)
          .map((record) => record.title)
          .join(", ")} 같은 표현이 있어요.`
      : "";
  const expressionEvidence =
    childRecords
      .map((record) => record.memo)
      .filter((memo) => memo && memo !== "그림으로 기록했어요.")
      .slice(-2)
      .join(" / ") || "";

  return {
    naturalInquiry: [
      {
        title: "탐구과정 즐기기",
        text:
          inquiryQuestionCount > 0 || childRecords.length > 1
            ? joinAnalysisText(
                `${normalizedChildName}은`,
                questionEvidence,
                recordEvidence,
                "질문과 반복 기록으로 변화를 확인하려는 모습이 보여요."
              )
            : "",
      },
      {
        title: "생활 속에서 탐구하기",
        text:
          soilRecords.length > 0 || careQuestionCount > 0
            ? joinAnalysisText(
                soilEvidence,
                "물, 흙, 햇빛을 식물 상태와 연결해 보려는 시도가 보여요."
              )
            : "",
      },
      {
        title: "자연과 더불어 살기",
        text:
          hasAffection || photoRecords.length > 0
            ? joinAnalysisText(
                photoEvidence,
                "식물을 조심히 살피고 돌봄이 필요한 대상으로 대하는 태도를 볼 수 있어요."
              )
            : "",
      },
    ],
    communication: [
      {
        title: "듣기와 말하기",
        text:
          questionCount > 0
            ? joinAnalysisText(
                `${normalizedChildName}은 식물에게 ${questionCount}번 질문했어요.`,
                questionEvidence,
                "자기 궁금증을 말로 표현했어요."
              )
            : "",
      },
      {
        title: "읽기와 쓰기에 관심 가지기",
        text:
          childRecords.length > 0
            ? joinAnalysisText(
                `그림 카드와 사진으로 ${childRecords.length}개의 기록을 남겼어요.`,
                leafEvidence,
                "선택한 그림과 사진으로 관찰 의미를 표현했어요."
              )
            : "",
      },
      {
        title: "책과 이야기 즐기기",
        text:
          hasAffection || expressionCount > 0
            ? expressionEvidence
              ? `메모에 "${expressionEvidence}"라고 남기며 자기 생각과 느낌을 이야기처럼 표현했어요.`
              : joinAnalysisText(
                  questionEvidence,
                  "식물을 대화 상대처럼 여기며 자기 생각과 느낌을 표현하려는 모습이 보여요."
                )
            : "",
      },
    ],
  };
}

function getUniqueChildNames(names: Array<string | undefined>) {
  return Array.from(
    new Set(
      names
        .map((name) => name?.trim())
        .filter(
          (name): name is string =>
            Boolean(name) && name !== "이름 없는 아이" && name !== "아이 미지정"
        )
    )
  ).sort((firstName, secondName) => firstName.localeCompare(secondName, "ko"));
}

function chooseFriendlyKoreanVoice(voices: SpeechSynthesisVoice[]) {
  const koreanVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("ko")
  );

  if (koreanVoices.length === 0) return undefined;

  const preferredKeywords = [
    "female",
    "woman",
    "girl",
    "young",
    "natural",
    "friendly",
    "여성",
    "한국어",
    "korean",
    "google",
  ];

  const scoredVoices = koreanVoices.map((voice) => {
    const voiceName = `${voice.name} ${voice.lang}`.toLowerCase();
    let score = voice.lang.toLowerCase() === "ko-kr" ? 2 : 0;

    if (voice.localService) score += 1;

    preferredKeywords.forEach((keyword) => {
      if (voiceName.includes(keyword)) score += 1;
    });

    return { voice, score };
  });

  scoredVoices.sort((a, b) => b.score - a.score);
  return scoredVoices[0]?.voice;
}

function audioBase64ToObjectUrl(audioBase64: string) {
  const binaryText = window.atob(audioBase64);
  const bytes = new Uint8Array(binaryText.length);

  for (let index = 0; index < binaryText.length; index += 1) {
    bytes[index] = binaryText.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: "audio/mpeg" });
  return URL.createObjectURL(blob);
}

function createShortSpeechText(text: string) {
  const cleanedText = text
    .replace(/\s+/g, " ")
    .replace(/^.+?:\s*/, "")
    .trim();

  if (cleanedText.length <= 180) return cleanedText;

  const sentences = cleanedText
    .split(/(?<=[.!?。]|요\.|요|다\.|다)\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const selectedSentences: string[] = [];
  let totalLength = 0;

  for (const sentence of sentences) {
    if (selectedSentences.length >= 3) break;
    if (totalLength > 0 && totalLength + sentence.length > 180) break;

    selectedSentences.push(sentence);
    totalLength += sentence.length;
  }

  const shortText =
    selectedSentences.join(" ") ||
    sentences[0] ||
    cleanedText.slice(0, 180).trim();

  return shortText;
}

function createAudioCacheKey(messageId: string, speechText: string) {
  let hash = 0;

  for (let index = 0; index < speechText.length; index += 1) {
    hash = (hash * 31 + speechText.charCodeAt(index)) >>> 0;
  }

  return `${messageId}:${speechText.length}:${hash}`;
}

function playToneSequence(
  tones: Array<{ frequency: number; start: number; duration: number; volume?: number }>,
  volume = 0.12
) {
  try {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();

    gain.connect(audioContext.destination);

    tones.forEach((tone) => {
      const oscillator = audioContext.createOscillator();
      const toneGain = audioContext.createGain();
      const toneStart = audioContext.currentTime + tone.start;
      const toneEnd = toneStart + tone.duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
      toneGain.gain.setValueAtTime(0.001, toneStart);
      toneGain.gain.exponentialRampToValueAtTime(
        tone.volume ?? volume,
        toneStart + 0.018
      );
      toneGain.gain.exponentialRampToValueAtTime(0.001, toneEnd);
      oscillator.connect(toneGain);
      toneGain.connect(gain);
      oscillator.start(toneStart);
      oscillator.stop(toneEnd);
    });

    window.setTimeout(() => {
      void audioContext.close();
    }, 600);
  } catch (error) {
    console.warn("효과음을 재생하지 못했어요.", error);
  }
}

function playChoiceSound() {
  playToneSequence(
    [
      { frequency: 1046, start: 0, duration: 0.08 },
      { frequency: 1568, start: 0.075, duration: 0.16 },
    ],
    0.12
  );
}

function playDingDongSound() {
  playToneSequence(
    [
      { frequency: 988, start: 0, duration: 0.11 },
      { frequency: 1318, start: 0.09, duration: 0.15 },
      { frequency: 1760, start: 0.21, duration: 0.22 },
    ],
    0.14
  );
}

async function requestTtsObjectUrl(text: string, openAiApiKey?: string) {
  const response = await fetch(API_TTS_URL, {
    method: "POST",
    headers: getApiHeaders(openAiApiKey),
    body: JSON.stringify({ text }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    audioBase64?: string;
    error?: string;
  };

  clearTestAccessCodeIfNeeded(response);

  if (!response.ok || !data.ok || !data.audioBase64) {
    throw new Error(data.error || "음성을 만들지 못했어요.");
  }

  return audioBase64ToObjectUrl(data.audioBase64);
}

function classifyPlantQuestion(questionText: string) {
  const compactQuestion = questionText.replace(/\s/g, "");
  const asksAboutWater = includesAny(compactQuestion, ["물", "목말", "마셔"]);
  const asksAboutRain = includesAny(compactQuestion, [
    "비오는",
    "비온",
    "비가",
    "빗물",
    "비맞",
  ]);
  const asksAboutLeaf = includesAny(compactQuestion, [
    "잎",
    "시들",
    "노랗",
    "갈색",
  ]);
  const asksAboutPain = includesAny(compactQuestion, [
    "아파",
    "아프",
    "아프니",
    "아픈",
    "괜찮아",
    "괜찮니",
    "상태",
    "힘들어",
  ]);
  const asksAboutHelpingPain =
    asksAboutPain &&
    includesAny(compactQuestion, [
      "도와",
      "도움",
      "어떻게",
      "어찌",
      "뭐해",
      "무엇",
    ]);
  const asksAboutLeafProblem = includesAny(compactQuestion, [
    "노랗",
    "노란",
    "갈색",
    "시들",
    "축",
    "말랐",
    "마른",
    "힘없",
  ]);
  const asksAboutSoil = includesAny(compactQuestion, [
    "흙",
    "바닥",
    "말랐",
    "촉촉",
  ]);
  const asksAboutWhiteThing = includesAny(compactQuestion, [
    "하얀",
    "하얗",
    "흰",
    "흰색",
    "곰팡",
  ]);
  const asksAboutSoilRole =
    asksAboutSoil &&
    includesAny(compactQuestion, [
      "왜",
      "필요",
      "뭐해",
      "무슨일",
      "역할",
      "왜있",
      "왜필요",
    ]);
  const asksAboutNoSoilGrowth =
    asksAboutSoil &&
    includesAny(compactQuestion, [
      "없어도",
      "없이",
      "없는데",
      "안써도",
      "안심어도",
      "안심고",
    ]) &&
    includesAny(compactQuestion, ["자라", "커", "살", "키워"]);
  const asksAboutPhoto = includesAny(compactQuestion, [
    "사진",
    "찍",
    "보여",
    "보이",
    "모습",
  ]);
  const asksAboutSun = includesAny(compactQuestion, [
    "햇빛",
    "햇볕",
    "빛",
    "해를",
    "해가",
    "해빛",
  ]);
  const asksAboutMood = includesAny(compactQuestion, [
    "기분",
    "어때",
    "괜찮",
    "아파",
    "아프",
  ]);
  const asksAboutDislike = includesAny(compactQuestion, [
    "싫어",
    "싫니",
    "힘들어",
    "무서워",
  ]);
  const asksAboutPlantPreference = includesAny(compactQuestion, [
    "무엇을좋아",
    "언제좋아",
    "언제기분좋",
    "언제행복",
    "뭘좋아",
    "뭐좋아",
    "어떤걸좋아",
    "어떤것을좋아",
    "좋아하는게뭐",
    "좋아하는것",
    "좋아하는거",
    "좋아하는건",
    "좋아하는건뭐",
    "좋아하는건뭐야",
    "좋아하는건무엇",
  ]);
  const asksAboutLike =
    (asksAboutPlantPreference ||
      includesAny(compactQuestion, ["좋아", "좋니", "좋은"])) &&
    !asksAboutWater &&
    !asksAboutSun &&
    !asksAboutRain;
  const asksAboutFlower = includesAny(compactQuestion, ["꽃", "피어", "펴"]);
  const asksAboutNoFlower =
    asksAboutFlower &&
    includesAny(compactQuestion, ["안피", "안펴", "안나", "없어"]);
  const asksAboutFruit = includesAny(compactQuestion, [
    "열매",
    "토마토",
    "꼬투리",
    "씨앗",
  ]);
  const asksAboutRoot = includesAny(compactQuestion, ["뿌리"]);
  const asksAboutHarvest = includesAny(compactQuestion, [
    "언제먹",
    "언제따",
    "수확",
    "빨개",
    "익어",
  ]);
  const asksAboutEdiblePart = includesAny(compactQuestion, [
    "뭘먹",
    "어디먹",
    "먹는부분",
    "무슨부분",
  ]);
  const asksAboutRegrowthAfterHarvest =
    includesAny(compactQuestion, [
      "또자라",
      "다시자라",
      "계속자라",
      "또나와",
      "다시나와",
      "또나요",
      "다시나요",
    ]) &&
    includesAny(compactQuestion, ["먹", "자르", "따", "수확"]);
  const asksAboutSpeciesColor = includesAny(compactQuestion, [
    "무슨색",
    "색깔",
    "색이",
    "어떤색",
  ]);
  const asksAboutSpeciesGrowth = includesAny(compactQuestion, [
    "얼마나커",
    "얼마나자",
    "얼마나걸",
    "얼마나길",
    "얼만큼",
    "얼마큼",
    "키가",
    "길이",
    "길어",
    "자라",
  ]);
  const saysEncouragement = includesAny(compactQuestion, [
    "건강하게자라",
    "잘자라",
    "쑥쑥",
    "힘내",
    "아프지마",
    "튼튼",
    "화이팅",
    "파이팅",
  ]);
  const asksAboutHungry = includesAny(compactQuestion, [
    "배고",
    "밥",
    "먹고싶",
  ]);
  const asksAboutEating = includesAny(compactQuestion, [
    "먹을수",
    "먹어도",
    "먹을래",
    "먹을수있",
    "어떻게먹",
    "먹는방법",
    "먹을방법",
    "먹는법",
    "어찌먹",
    "뭐해먹",
    "뭐로먹",
    "먹을때",
    "먹는거",
    "어떻게요리",
    "요리해",
  ]);
  const asksAboutHurting = includesAny(compactQuestion, [
    "만져",
    "만져도",
    "만질",
    "만져볼",
    "꺾",
    "뽑",
    "자르",
    "찢",
    "때려",
    "밟",
  ]);
  const asksAboutChemicals = includesAny(compactQuestion, [
    "약",
    "비료",
    "분무",
    "뿌려도",
  ]);
  const asksAboutCareMethod = includesAny(compactQuestion, [
    "어떻게키",
    "어떻게돌",
    "키우는법",
    "키우려면",
    "돌보는법",
    "관리",
    "잘살",
    "건강",
    "필요한거",
    "필요한것",
    "뭐가필요",
    "무엇이필요",
  ]);
  const asksAboutWaterSchedule = includesAny(compactQuestion, [
    "며칠마다",
    "몇일마다",
    "얼마마다",
    "물주기",
    "물주는주기",
    "언제물",
    "언제줘",
    "언제주",
  ]);
  const asksAboutWaterAmount =
    asksAboutWater &&
    includesAny(compactQuestion, [
      "얼마나",
      "얼만큼",
      "얼마큼",
      "얼마만큼",
      "몇번",
      "몇회",
      "양",
      "많이",
      "조금",
    ]);
  const asksAboutDance = compactQuestion.includes("춤");
  const asksAboutMovement = includesAny(compactQuestion, [
    "움직",
    "걸어",
    "뛰어",
    "도망",
  ]);
  const asksAboutSchool = includesAny(compactQuestion, [
    "학교",
    "교실",
    "친구",
  ]);
  const asksAboutChildlikeQuestion = includesAny(compactQuestion, [
    "화장실",
    "노래",
    "노래하면",
    "노래해",
    "예쁜말",
    "칭찬",
    "심심",
    "놀",
    "놀이",
    "웃어",
    "웃니",
    "울어",
    "울니",
    "무서",
    "좋아해줘",
    "친구",
  ]);
  const asksAboutSleep = includesAny(compactQuestion, [
    "잠",
    "자니",
    "자는",
    "밤",
    "꿈",
  ]);
  const asksAboutTalking = includesAny(compactQuestion, [
    "말할수",
    "말해",
    "말을못",
    "왜말",
    "말못",
    "목소리",
  ]);
  const asksAboutIdentity = includesAny(compactQuestion, [
    "외계인",
    "로봇",
    "마법",
  ]);
  const asksAboutName = includesAny(compactQuestion, ["이름", "누구", "뭐야"]);
  const saysGreeting = includesAny(compactQuestion, [
    "안녕",
    "하이",
    "반가워",
    "잘자",
    "잘있어",
  ]);
  const saysAffection =
    !asksAboutPlantPreference &&
    !asksAboutWater &&
    !asksAboutSun &&
    !asksAboutSoil &&
    !asksAboutLeaf &&
    !asksAboutPain &&
    !asksAboutEating &&
    !asksAboutHungry &&
    !asksAboutRain &&
    includesAny(compactQuestion, [
      "사랑해",
      "네가좋아",
      "너가좋아",
      "니가좋아",
      "너좋아",
      "너를좋아",
      "널좋아",
      "좋아해",
      "고마워",
      "귀여워",
      "예뻐",
      "이뻐",
      "최고",
    ]);
  const asksAboutSmell = includesAny(compactQuestion, [
    "냄새",
    "냄새나",
    "향",
    "향이",
    "향기",
    "향나",
  ]);
  const asksAboutPlace = includesAny(compactQuestion, [
    "어디",
    "자리",
    "놓아",
    "둬",
  ]);
  const asksAboutAge = includesAny(compactQuestion, ["몇살", "나이", "태어"]);
  const asksAboutSeason = includesAny(compactQuestion, [
    "겨울",
    "여름",
    "봄",
    "가을",
    "계절",
    "추워",
    "추우",
    "차가",
    "차갑",
    "춥",
    "더워",
    "더우",
    "뜨거",
    "뜨겁",
    "살수",
    "살아",
  ]);
  const asksAboutLifecycle = includesAny(compactQuestion, [
    "언제시들",
    "시들때",
    "시드는",
    "죽어",
    "죽니",
    "죽기",
    "죽기도",
    "죽을",
    "죽는",
    "죽나",
    "죽어도",
    "얼마나살",
    "몇년",
    "수명",
    "오래살",
    "계속살",
  ]);
  const asksAboutWiltReason = includesAny(compactQuestion, [
    "왜시들",
    "시드는이유",
    "왜죽",
    "죽는이유",
    "힘없는이유",
    "왜힘없",
  ]);
  const asksAboutPlantFamily = includesAny(compactQuestion, [
    "아기",
    "엄마",
    "아빠",
    "부모",
    "가족",
    "낳",
    "결혼",
    "남편",
    "아내",
    "짝",
  ]);
  const asksAboutSpeciesInfo =
    asksAboutFlower ||
    asksAboutFruit ||
    asksAboutRoot ||
    asksAboutHarvest ||
    asksAboutEdiblePart ||
    asksAboutRegrowthAfterHarvest ||
    asksAboutSpeciesColor ||
    asksAboutSpeciesGrowth;

  return {
    compactQuestion,
    asksAboutWater,
    asksAboutLeaf,
    asksAboutPain,
    asksAboutHelpingPain,
    asksAboutLeafProblem,
    asksAboutSoil,
    asksAboutSoilRole,
    asksAboutNoSoilGrowth,
    asksAboutWhiteThing,
    asksAboutPhoto,
    asksAboutSun,
    asksAboutMood,
    asksAboutDislike,
    asksAboutPlantPreference,
    asksAboutLike,
    asksAboutRain,
    asksAboutFlower,
    asksAboutNoFlower,
    asksAboutFruit,
    asksAboutRoot,
    asksAboutHarvest,
    asksAboutEdiblePart,
    asksAboutRegrowthAfterHarvest,
    asksAboutSpeciesColor,
    asksAboutSpeciesGrowth,
    asksAboutHungry,
    asksAboutEating,
    asksAboutHurting,
    asksAboutChemicals,
    asksAboutCareMethod,
    asksAboutWaterSchedule,
    asksAboutWaterAmount,
    asksAboutDance,
    asksAboutMovement,
    asksAboutSchool,
    asksAboutChildlikeQuestion,
    asksAboutSleep,
    asksAboutTalking,
    asksAboutIdentity,
    asksAboutName,
    saysGreeting,
    saysAffection,
    saysEncouragement,
    asksAboutSmell,
    asksAboutPlace,
    asksAboutAge,
    asksAboutSeason,
    asksAboutLifecycle,
    asksAboutWiltReason,
    asksAboutPlantFamily,
    asksAboutSpeciesInfo,
  };
}

function shouldUseAiChatFallback(questionText: string) {
  const classification = classifyPlantQuestion(questionText);
  const hasUnsafeNonPlantTopic = includesAny(classification.compactQuestion, [
    "때려",
    "죽여",
    "미워해",
    "바보",
    "싫어해줘",
    "개인정보",
    "전화번호",
    "주소",
  ]);

  if (hasUnsafeNonPlantTopic) return false;

  const isPlantChatScope =
    classification.asksAboutWater ||
    classification.asksAboutLeaf ||
    classification.asksAboutPain ||
    classification.asksAboutHelpingPain ||
    classification.asksAboutLeafProblem ||
    classification.asksAboutSoil ||
    classification.asksAboutNoSoilGrowth ||
    classification.asksAboutWhiteThing ||
    classification.asksAboutPhoto ||
    classification.asksAboutSun ||
    classification.asksAboutMood ||
    classification.asksAboutDislike ||
    classification.asksAboutPlantPreference ||
    classification.asksAboutLike ||
    classification.asksAboutHungry ||
    classification.asksAboutDance ||
    classification.asksAboutMovement ||
    classification.asksAboutSchool ||
    classification.asksAboutChildlikeQuestion ||
    classification.asksAboutSleep ||
    classification.asksAboutTalking ||
    classification.asksAboutIdentity ||
    classification.asksAboutName ||
    classification.saysGreeting ||
    classification.saysAffection ||
    classification.asksAboutAge ||
    classification.asksAboutPlantFamily ||
    classification.asksAboutSpeciesInfo ||
    includesAny(classification.compactQuestion, [
      "식물",
      "잎",
      "줄기",
      "뿌리",
      "흙",
      "물",
      "햇빛",
      "화분",
      "자라",
      "시들",
      "꽃",
      "열매",
      "씨앗",
    ]);

  if (!isPlantChatScope) return true;

  const shouldStayLocal =
    classification.asksAboutHelpingPain ||
    classification.asksAboutNoSoilGrowth ||
    classification.asksAboutWhiteThing ||
    classification.asksAboutEating ||
    classification.asksAboutHurting ||
    classification.asksAboutChemicals ||
    classification.asksAboutWaterSchedule ||
    classification.asksAboutWaterAmount ||
    classification.asksAboutEdiblePart ||
    classification.asksAboutRegrowthAfterHarvest ||
    classification.asksAboutTalking ||
    classification.saysGreeting ||
    classification.saysAffection ||
    classification.saysEncouragement;

  return !shouldStayLocal;
}
function createRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function trimChatMessages(messages: ChatMessage[]) {
  return messages.slice(-MAX_CHAT_MESSAGES);
}

function normalizeAiCacheQuestion(question: string) {
  return question.replace(/\s+/g, " ").trim().toLowerCase();
}

function createAiChatCacheKey(plantName: string, plantType: string, question: string) {
  return [
    normalizePlantText(plantName),
    normalizePlantText(plantType),
    normalizeAiCacheQuestion(question),
  ].join("|");
}

function trimAiChatCache(cache: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(cache).slice(-MAX_AI_CHAT_CACHE_ENTRIES)
  );
}

function normalizeAiChatUsage(usage: Partial<AiChatUsage> | undefined, dateKey: string): AiChatUsage {
  if (usage?.dateKey !== dateKey) {
    return { dateKey, count: 0 };
  }

  return {
    dateKey,
    count: Math.max(0, Number(usage.count) || 0),
  };
}

function getAiLimitAnswer() {
  return "오늘은 내가 생각을 많이 해서 잠깐 쉬어야 해요. 내일 또 만나서 궁금한 이야기를 들려주세요.";
}

function getRecordCreatedAt(record: ObservationRecord) {
  const createdAt = Number(record.id.split("-")[0]);

  if (Number.isFinite(createdAt) && createdAt > 0) {
    return createdAt;
  }

  return new Date(record.dateKey).getTime();
}

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("이미지를 처리할 수 없어요."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const resizedImage = canvas.toDataURL("image/jpeg", 0.75);
        resolve(resizedImage);
      };

      image.onerror = () => reject(new Error("이미지를 불러올 수 없어요."));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요."));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiChatCache, setAiChatCache] = useState<Record<string, string>>({});
  const [aiChatUsage, setAiChatUsage] = useState<AiChatUsage>({
    dateKey: "",
    count: 0,
  });
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [openAiApiKeyError, setOpenAiApiKeyError] = useState("");
  const [showOpenAiKeyPanel, setShowOpenAiKeyPanel] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [currentChildName, setCurrentChildName] = useState("");
  const [childSearchText, setChildSearchText] = useState("");
  const [analysisChildFilter, setAnalysisChildFilter] = useState("");
  const [analysisTab, setAnalysisTab] = useState<
    "report" | "roster" | "participation"
  >("report");
  const [childRoster, setChildRoster] = useState<string[]>([]);
  const [readingMessageId, setReadingMessageId] = useState("");
  const [loadingAudioId, setLoadingAudioId] = useState("");
  const [careMotion, setCareMotion] = useState<"" | "water" | "sun">("");
  const [waterPromptDismissedDateKey, setWaterPromptDismissedDateKey] =
    useState("");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>(
    []
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatMessageListRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const activeAudioIdRef = useRef("");
  const audioUrlCacheRef = useRef<Record<string, string>>({});
  const audioPreloadRef = useRef<Set<string>>(new Set());
  const waterPromptSoundDateRef = useRef("");

  const [plant, setPlant] = useState<Plant | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [selectedRecordDateKey, setSelectedRecordDateKey] = useState("all");
  const [recordSummaryTab, setRecordSummaryTab] = useState<
    "records" | "weekly" | "photos" | "attention"
  >("records");
  const [plantName, setPlantName] = useState("");
  const [plantType, setPlantType] = useState("");
  const [plantMemo, setPlantMemo] = useState("");
  const [teacherSummary, setTeacherSummary] = useState("");
  const [teacherOriginInfo, setTeacherOriginInfo] = useState("");
  const [teacherClassificationInfo, setTeacherClassificationInfo] = useState("");
  const [teacherNameStoryInfo, setTeacherNameStoryInfo] = useState("");
  const [teacherEdibleInfo, setTeacherEdibleInfo] = useState("");
  const [teacherFlowerInfo, setTeacherFlowerInfo] = useState("");
  const [teacherFruitInfo, setTeacherFruitInfo] = useState("");
  const [teacherObservationPoints, setTeacherObservationPoints] = useState("");
  const [teacherCaution, setTeacherCaution] = useState("");
  const [teacherGrowthInfo, setTeacherGrowthInfo] = useState("");
  const [teacherCareInfo, setTeacherCareInfo] = useState("");
  const [teacherLightInfo, setTeacherLightInfo] = useState("");
  const [teacherEnvironmentInfo, setTeacherEnvironmentInfo] = useState("");
  const [teacherLifecycleInfo, setTeacherLifecycleInfo] = useState("");
  const [teacherSmellInfo, setTeacherSmellInfo] = useState("");
  const [teacherFavoriteInfo, setTeacherFavoriteInfo] = useState("");
  const [teacherDislikeInfo, setTeacherDislikeInfo] = useState("");
  const [teacherWaterIntervalDays, setTeacherWaterIntervalDays] = useState(2);
  const [teacherSunGoal, setTeacherSunGoal] = useState(1);
  const [teacherCareChecklist, setTeacherCareChecklist] = useState("");
  const [teacherChildAnswerHints, setTeacherChildAnswerHints] = useState("");
  const [isTeacherDraftLoading, setIsTeacherDraftLoading] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>({
    tone: "idle",
    text: "식물 종류를 입력하고 자동 초안을 불러올 수 있어요.",
  });

  const [careState, setCareState] = useState<CareState>(defaultCareState);
  const [records, setRecords] = useState<ObservationRecord[]>([]);

  const [leafColor, setLeafColor] = useState("");
  const [leafColorIcon, setLeafColorIcon] = useState("");
  const [leafShape, setLeafShape] = useState("");
  const [leafShapeIcon, setLeafShapeIcon] = useState("");
  const [leafMemo, setLeafMemo] = useState("");

  const [soilState, setSoilState] = useState("");
  const [soilStateIcon, setSoilStateIcon] = useState("");
  const [soilColor, setSoilColor] = useState("");
  const [soilColorIcon, setSoilColorIcon] = useState("");
  const [soilMemo, setSoilMemo] = useState("");

  const [photoChange, setPhotoChange] = useState("");
  const [photoChangeIcon, setPhotoChangeIcon] = useState("");
  const [photoFeeling, setPhotoFeeling] = useState("");
  const [photoFeelingIcon, setPhotoFeelingIcon] = useState("");
  const [photoMemo, setPhotoMemo] = useState("");
  const [photoImageData, setPhotoImageData] = useState("");
  const [observationNotice, setObservationNotice] = useState("");
  const [recordSaveNotice, setRecordSaveNotice] = useState("");
  const [analyzingPhotoRecordId, setAnalyzingPhotoRecordId] = useState("");
  const [photoAnalysisNotice, setPhotoAnalysisNotice] = useState("");

  const todayLabel = getTodayLabel();
  const todayKey = getDateKey(new Date());

  const mainImagePath = "/icons/main-plant.png";
  const logoPath = "/icons/plant-logo.png";
  const dateIconPath = "/icons/date.png";

  const leafColorOptions: ChoiceOption[] = [
    { label: "초록색", icon: "/icons/leaf-green.png", color: "#E7F4D9" },
    { label: "노란색", icon: "/icons/leaf-yellow.png", color: "#FFF1B8" },
    { label: "갈색", icon: "/icons/leaf-brown.png", color: "#E8D1B0" },
    { label: "새 잎", icon: "/icons/leaf-new.png", color: "#DDF3D8" },
  ];

  const leafShapeOptions: ChoiceOption[] = [
    { label: "튼튼해요", icon: "/icons/leaf-strong.png", color: "#E4F4DB" },
    { label: "축 처졌어요", icon: "/icons/leaf-droop.png", color: "#FFF0C6" },
    { label: "구멍이 있어요", icon: "/icons/leaf-hole.png", color: "#F7E3C8" },
    { label: "말랐어요", icon: "/icons/leaf-dry.png", color: "#EDD7BE" },
  ];

  const soilStateOptions: ChoiceOption[] = [
    { label: "촉촉해요", icon: "/icons/soil-wet.png", color: "#DDF0FF" },
    { label: "조금 말랐어요", icon: "/icons/soil-dry.png", color: "#F7E1BB" },
    { label: "많이 말랐어요", icon: "/icons/soil-crack.png", color: "#E7C7AA" },
    { label: "잘 모르겠어요", icon: "/icons/unknown.png", color: "#ECECEC" },
  ];

  const soilColorOptions: ChoiceOption[] = [
    { label: "어두워요", icon: "/icons/soil-wet.png", color: "#D8C0A3" },
    { label: "밝아졌어요", icon: "/icons/soil-dry.png", color: "#F2D7AE" },
    { label: "갈라졌어요", icon: "/icons/soil-crack.png", color: "#E2BE9D" },
  ];

  const sproutBaseStateOptions: ChoiceOption[] = [
    { label: "촉촉해요", icon: "/icons/water.png", color: "#DDF0FF" },
    { label: "마르기 시작했어요", icon: "/icons/soil-dry.png", color: "#F7E1BB" },
    { label: "물이 고였어요", icon: "/icons/soil-wet.png", color: "#DDF0FF" },
    { label: "냄새가 나요", icon: "/icons/observe.png", color: "#FFF0C6" },
  ];

  const sproutBaseLookOptions: ChoiceOption[] = [
    { label: "깨끗해요", icon: "/icons/main-plant.png", color: "#E4F4DB" },
    { label: "뿌리가 보여요", icon: "/icons/leaf-new.png", color: "#DDF3D8" },
    { label: "물이 고였어요", icon: "/icons/water.png", color: "#DDF0FF" },
    { label: "하얀 것이 보여요", icon: "/icons/unknown.png", color: "#ECECEC" },
  ];

  const photoChangeOptions: ChoiceOption[] = [
    { label: "커졌어요", icon: "/icons/growth.png", color: "#E4F4DB" },
    { label: "새 잎이 났어요", icon: "/icons/leaf-new.png", color: "#DDF3D8" },
    { label: "색이 달라졌어요", icon: "/icons/leaf-yellow.png", color: "#FFF1B8" },
    { label: "잘 모르겠어요", icon: "/icons/unknown.png", color: "#ECECEC" },
  ];

  const photoFeelingOptions: ChoiceOption[] = [
    { label: "좋아 보여요", icon: "/icons/main-plant.png", color: "#E4F4DB" },
    { label: "살펴봐야 해요", icon: "/icons/observe.png", color: "#FFF0C6" },
    { label: "돌봄이 필요해요", icon: "/icons/care.png", color: "#F7E3C8" },
  ];

  useEffect(() => {
    let isMounted = true;
    let localPlant: Plant | null = null;
    let localCareState: CareState = defaultCareState;
    let localRecords: ObservationRecord[] = [];
    let localChatMessages: ChatMessage[] = [];
    let localCurrentChildName = "";
    let localChildRoster: string[] = [];
    let localAiChatCache: Record<string, string> = {};
    let localAiChatUsage: AiChatUsage = { dateKey: todayKey, count: 0 };
    let localOpenAiApiKey = "";

    const savedCareState = localStorage.getItem(CARE_STORAGE_KEY);

    if (savedCareState) {
      try {
        const parsed = JSON.parse(savedCareState) as Partial<CareState>;

        localCareState = normalizeCareState(parsed, todayKey);
      } catch {
        localStorage.removeItem(CARE_STORAGE_KEY);
      }
    }

    const savedPlant = localStorage.getItem(PLANT_STORAGE_KEY);

    if (savedPlant) {
      try {
        const parsed = JSON.parse(savedPlant) as Plant;
        localPlant = parsed;
      } catch {
        localStorage.removeItem(PLANT_STORAGE_KEY);
      }
    }

    const savedRecords = localStorage.getItem(RECORD_STORAGE_KEY);

    if (savedRecords) {
      try {
        localRecords = JSON.parse(savedRecords) as ObservationRecord[];
      } catch {
        localStorage.removeItem(RECORD_STORAGE_KEY);
      }
    }

    const savedChatMessages = localStorage.getItem(CHAT_STORAGE_KEY);

    if (savedChatMessages) {
      try {
        const parsedChatMessages = JSON.parse(savedChatMessages);
        if (Array.isArray(parsedChatMessages)) {
          localChatMessages = trimChatMessages(parsedChatMessages as ChatMessage[]);
        }
      } catch {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    }

    const savedAiChatCacheText = localStorage.getItem(AI_CHAT_CACHE_STORAGE_KEY);
    if (savedAiChatCacheText) {
      try {
        const savedAiChatCache = JSON.parse(savedAiChatCacheText);
        if (savedAiChatCache && typeof savedAiChatCache === "object") {
          localAiChatCache = trimAiChatCache(savedAiChatCache as Record<string, string>);
        }
      } catch {
        localStorage.removeItem(AI_CHAT_CACHE_STORAGE_KEY);
      }
    }

    const savedAiChatUsageText = localStorage.getItem(AI_CHAT_USAGE_STORAGE_KEY);
    if (savedAiChatUsageText) {
      try {
        localAiChatUsage = normalizeAiChatUsage(
          JSON.parse(savedAiChatUsageText) as Partial<AiChatUsage>,
          todayKey
        );
      } catch {
        localStorage.removeItem(AI_CHAT_USAGE_STORAGE_KEY);
      }
    }

    const savedChildName = localStorage.getItem(CHILD_STORAGE_KEY);
    if (savedChildName) {
      localCurrentChildName = savedChildName;
    }

    const savedChildRosterText = localStorage.getItem(CHILD_ROSTER_STORAGE_KEY);
    if (savedChildRosterText) {
      try {
        const savedChildRoster = JSON.parse(savedChildRosterText);
        if (Array.isArray(savedChildRoster)) {
          localChildRoster = getUniqueChildNames(savedChildRoster);
        }
      } catch {
        localStorage.removeItem(CHILD_ROSTER_STORAGE_KEY);
      }
    }

    const savedOpenAiApiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    if (savedOpenAiApiKey) {
      localOpenAiApiKey = savedOpenAiApiKey;
    }

    async function loadInitialState() {
      let nextState: DbAppState = {
        plant: localPlant,
        careState: localCareState,
        records: localRecords,
        chatMessages: localChatMessages,
        childRoster: localChildRoster,
        currentChildName: localCurrentChildName,
      };

      try {
        const dbState = await loadStateFromDb();

        if (
          dbState &&
          (dbState.plant ||
            dbState.records.length > 0 ||
            (dbState.chatMessages?.length ?? 0) > 0 ||
            (dbState.childRoster?.length ?? 0) > 0 ||
            Boolean(dbState.currentChildName?.trim()))
        ) {
          nextState = {
            plant: dbState.plant ?? localPlant,
            careState: normalizeCareState(dbState.careState, todayKey),
            records: mergeRecordsWithLocalMetadata(
              dbState.records,
              localRecords
            ),
            chatMessages:
              (dbState.chatMessages?.length ?? 0) > 0
                ? dbState.chatMessages
                : localChatMessages,
            childRoster: getUniqueChildNames([
              ...localChildRoster,
              ...(dbState.childRoster ?? []),
            ]),
            currentChildName:
              dbState.currentChildName?.trim() || localCurrentChildName,
          };
        }
      } catch {
        nextState = {
          plant: localPlant,
          careState: localCareState,
          records: localRecords,
          chatMessages: localChatMessages,
          childRoster: localChildRoster,
          currentChildName: localCurrentChildName,
        };
      }

      if (!isMounted) return;

      setPlant(nextState.plant);
      setPlantName(nextState.plant?.name ?? "");
      setPlantType(nextState.plant?.type ?? "");
      setPlantMemo(nextState.plant?.memo ?? "");
      setTeacherSummary(nextState.plant?.teacherInfo?.summary ?? "");
      setTeacherOriginInfo(nextState.plant?.teacherInfo?.originInfo ?? "");
      setTeacherClassificationInfo(
        nextState.plant?.teacherInfo?.classificationInfo ?? ""
      );
      setOpenAiApiKey(localOpenAiApiKey);
      setTeacherNameStoryInfo(nextState.plant?.teacherInfo?.nameStoryInfo ?? "");
      setTeacherEdibleInfo(nextState.plant?.teacherInfo?.edibleInfo ?? "");
      setTeacherFlowerInfo(nextState.plant?.teacherInfo?.flowerInfo ?? "");
      setTeacherFruitInfo(nextState.plant?.teacherInfo?.fruitInfo ?? "");
      setTeacherObservationPoints(
        nextState.plant?.teacherInfo?.observationPoints ?? ""
      );
      setTeacherCaution(nextState.plant?.teacherInfo?.caution ?? "");
      setTeacherGrowthInfo(nextState.plant?.teacherInfo?.growthInfo ?? "");
      setTeacherCareInfo(nextState.plant?.teacherInfo?.careInfo ?? "");
      setTeacherLightInfo(nextState.plant?.teacherInfo?.lightInfo ?? "");
      setTeacherEnvironmentInfo(
        nextState.plant?.teacherInfo?.environmentInfo ?? ""
      );
      setTeacherLifecycleInfo(
        nextState.plant?.teacherInfo?.lifecycleInfo ?? ""
      );
      setTeacherSmellInfo(nextState.plant?.teacherInfo?.smellInfo ?? "");
      setTeacherFavoriteInfo(nextState.plant?.teacherInfo?.favoriteInfo ?? "");
      setTeacherDislikeInfo(nextState.plant?.teacherInfo?.dislikeInfo ?? "");
      setTeacherWaterIntervalDays(
        clampNumber(
          nextState.plant?.teacherInfo?.recommendedWaterIntervalDays,
          defaultCareState.waterIntervalDays,
          1,
          14
        )
      );
      setTeacherSunGoal(
        clampNumber(
          nextState.plant?.teacherInfo?.recommendedSunGoal,
          defaultCareState.sunGoal,
          1,
          5
        )
      );
      setTeacherCareChecklist(
        nextState.plant?.teacherInfo?.careChecklist ?? ""
      );
      setTeacherChildAnswerHints(
        nextState.plant?.teacherInfo?.childAnswerHints ?? ""
      );
      setDraftStatus({
        tone: nextState.plant?.teacherInfo ? "success" : "idle",
        text: nextState.plant?.teacherInfo
          ? "교사 확인 정보가 저장되어 있어요."
          : "식물 종류를 입력하고 자동 초안을 불러올 수 있어요.",
      });
      setCareState(nextState.careState);
      setRecords(nextState.records);
      setChatMessages(trimChatMessages(nextState.chatMessages ?? []));
      setChildRoster(
        getUniqueChildNames([
          ...(nextState.childRoster ?? []),
          nextState.currentChildName ?? "",
          ...nextState.records.map((record) => record.childName),
          ...(nextState.chatMessages ?? []).map((chatMessage) => chatMessage.childName),
        ])
      );
      setCurrentChildName(nextState.currentChildName ?? "");
      setAiChatCache(localAiChatCache);
      setAiChatUsage(localAiChatUsage);
      setOpenAiApiKey(localOpenAiApiKey);
      setIsStateLoaded(true);
    }

    loadInitialState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const trimmedChildName = currentChildName.trim();

    if (trimmedChildName) {
      localStorage.setItem(CHILD_STORAGE_KEY, trimmedChildName);
    } else {
      localStorage.removeItem(CHILD_STORAGE_KEY);
    }
  }, [currentChildName]);

  useEffect(() => {
    if (openAiApiKey.trim()) {
      localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, openAiApiKey.trim());
      setOpenAiApiKeyError("");
    } else {
      localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    }
  }, [openAiApiKey]);

  useEffect(() => {
    if (screen !== "chat") return;

    const scrollToLatestChat = () => {
      if (chatMessageListRef.current) {
        chatMessageListRef.current.scrollTop =
          chatMessageListRef.current.scrollHeight;
      }

      chatEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
    };

    scrollToLatestChat();
    window.requestAnimationFrame(scrollToLatestChat);
    window.setTimeout(scrollToLatestChat, 80);
  }, [chatMessages.length, loadingAudioId, readingMessageId, screen, speechError]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.speechSynthesis ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      return;
    }

    const loadVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();

      if (audioRef.current) {
        audioRef.current.pause();
      }

      Object.values(audioUrlCacheRef.current).forEach((audioUrl) => {
        URL.revokeObjectURL(audioUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (!isStateLoaded) return;

    Object.entries(CARE_REACTION_SPEECH).forEach(([key, text]) => {
      preloadSpeechText(text, `care-reaction-${key}`);
    });
  }, [isStateLoaded]);

  useEffect(() => {
    if (!isStateLoaded) return;

    chatMessages.slice(-3).forEach((chatMessage) => {
      preloadSpeechText(chatMessage.answer, chatMessage.id);
    });
  }, [chatMessages, isStateLoaded]);

  useEffect(() => {
    if (!isStateLoaded) return;

    records
      .filter(
        (record) =>
          record.type === "photo" && record.imageData && record.photoAnalysis
      )
      .slice(-3)
      .forEach((record) => {
      preloadSpeechText(
          getPhotoAnalysisChildText(record.photoAnalysis),
          `photo-child-${record.id}`
        );
      });
  }, [isStateLoaded, records]);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    setIsAppInstalled(standaloneQuery.matches);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsAppInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isStateLoaded) return;
    if (careState.countDateKey === todayKey) return;

    setCareState((prev) => ({
      ...prev,
      waterCount: 0,
      sunCount: 0,
      countDateKey: todayKey,
    }));
  }, [careState.countDateKey, isStateLoaded, todayKey]);

  useEffect(() => {
    if (!isStateLoaded) return;

    setAiChatUsage((prev) => normalizeAiChatUsage(prev, todayKey));
  }, [isStateLoaded, todayKey]);

  const knownChildNames = getUniqueChildNames([
    ...childRoster,
    currentChildName,
    ...records.map((record) => record.childName),
    ...chatMessages.map((message) => message.childName),
  ]);
  const knownChildNameSignature = knownChildNames.join("\n");
  const filteredChildNames = knownChildNames
    .filter((childName) =>
      normalizePlantText(childName).includes(normalizePlantText(childSearchText))
    )
    .slice(0, 6);
  const analysisVisibleChildNames = knownChildNames.filter((childName) =>
    normalizePlantText(childName).includes(normalizePlantText(analysisChildFilter))
  );

  useEffect(() => {
    if (!isStateLoaded) return;

    if (plant) {
      localStorage.setItem(PLANT_STORAGE_KEY, JSON.stringify(plant));
    } else {
      localStorage.removeItem(PLANT_STORAGE_KEY);
    }

    localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(careState));
    localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records));
    const savedChatMessages = trimChatMessages(chatMessages);

    if (savedChatMessages.length !== chatMessages.length) {
      setChatMessages(savedChatMessages);
      return;
    }

    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(savedChatMessages));
    localStorage.setItem(
      AI_CHAT_CACHE_STORAGE_KEY,
      JSON.stringify(trimAiChatCache(aiChatCache))
    );
    localStorage.setItem(AI_CHAT_USAGE_STORAGE_KEY, JSON.stringify(aiChatUsage));
    localStorage.setItem(
      CHILD_ROSTER_STORAGE_KEY,
      JSON.stringify(knownChildNames)
    );

    saveStateToDb({
      plant,
      careState,
      records,
      chatMessages: savedChatMessages,
      childRoster: knownChildNames,
      currentChildName,
    }).catch((error) => {
      console.error("DB 저장 실패:", error);
    });
  }, [
    careState,
    chatMessages,
    currentChildName,
    aiChatCache,
    aiChatUsage,
    isStateLoaded,
    knownChildNameSignature,
    plant,
    records,
  ]);

  const plantDisplayName = plant?.name || "초록이";
  const plantDisplayType = plant?.type || "등록해주세요! 🌱";
  const plantDisplayMemo = plant?.memo || "이름이랑 종류를 알려주면 대화할 수 있어요.";
  const teacherInfo = plant?.teacherInfo;
  const speciesPreset = getSpeciesPresetFromPlantType(plantDisplayType);
  const activeChildName = currentChildName.trim() || "아이 미지정";
  const hasSelectedChild = Boolean(currentChildName.trim());
  const currentPlantRecords = plant
    ? records.filter(
        (record) =>
          record.plantName === plant.name && record.plantType === plant.type
      )
    : records;
  const activeChildRecords = currentPlantRecords.filter(
    (record) => (record.childName || "아이 미지정") === activeChildName
  );
  const activeChildMessages = chatMessages.filter(
    (message) => (message.childName || "아이 미지정") === activeChildName
  );
  const visibleChatMessages = chatMessages.slice(-1);
  const hiddenChatMessageCount = Math.max(
    0,
    chatMessages.length - visibleChatMessages.length
  );
  const childCurriculumReport = buildChildCurriculumReport(
    activeChildName,
    activeChildRecords,
    activeChildMessages
  );

  useEffect(() => {
    localStorage.setItem(
      CHILD_ROSTER_STORAGE_KEY,
      JSON.stringify(knownChildNames)
    );
  }, [knownChildNameSignature]);

  const addChildToRoster = () => {
    const newChildName = window.prompt("추가할 아이 이름을 입력해 주세요.");
    const trimmedChildName = newChildName?.trim();

    if (!trimmedChildName) return;

    const nextRoster = getUniqueChildNames([...knownChildNames, trimmedChildName]);

    setChildRoster(nextRoster);
    setCurrentChildName(trimmedChildName);
    localStorage.setItem(CHILD_STORAGE_KEY, trimmedChildName);
    localStorage.setItem(CHILD_ROSTER_STORAGE_KEY, JSON.stringify(nextRoster));

    saveStateToDb({
      plant,
      careState,
      records,
      chatMessages,
      childRoster: nextRoster,
      currentChildName: trimmedChildName,
    }).catch((error) => {
      console.error("아이 목록 저장 실패:", error);
      // localStorage에 저장됨 — 서버 저장 실패는 무시
    });
  };

  const selectChildName = (childName: string) => {
    playChoiceSound();
    setCurrentChildName(childName);
    setChildSearchText("");
    localStorage.setItem(CHILD_STORAGE_KEY, childName);

    saveStateToDb({
      plant,
      careState,
      records,
      chatMessages,
      childRoster: knownChildNames,
      currentChildName: childName,
    }).catch((error) => {
      console.error("아이 선택 저장 실패:", error);
    });
  };

  const todayWaterCount = careState.countDateKey === todayKey ? careState.waterCount : 0;
  const todaySunCount = careState.countDateKey === todayKey ? careState.sunCount : 0;
  const waterDoneToday = todayWaterCount >= careState.waterGoal;
  const daysSinceWatered = careState.lastWateredDateKey
    ? getDaysBetweenDateKeys(careState.lastWateredDateKey, todayKey)
    : careState.waterIntervalDays;
  const latestRecord = getLatestRecord(currentPlantRecords);
  const latestSoilRecord = getLatestRecord(currentPlantRecords, "soil");
  const latestLeafRecord = getLatestRecord(currentPlantRecords, "leaf");
  const latestPhotoRecord = getLatestRecord(currentPlantRecords, "photo");
  const latestAnalyzedPhotoRecord = currentPlantRecords
    .filter(
      (record) =>
        record.type === "photo" && record.imageData && record.photoAnalysis
    )
    .sort((a, b) => getRecordCreatedAt(b) - getRecordCreatedAt(a))[0];
  const latestPhotoAnalysis = latestAnalyzedPhotoRecord?.photoAnalysis;
  const latestPhotoAnalysisAttention =
    latestAnalyzedPhotoRecord &&
    getPhotoAnalysisAttention(latestAnalyzedPhotoRecord);
  const daysSinceLastRecord = latestRecord
    ? getDaysBetweenDateKeys(latestRecord.dateKey, todayKey)
    : 7;
  const soilLooksDry =
    latestSoilRecord?.firstValue === "많이 말랐어요" ||
    latestSoilRecord?.firstValue === "조금 말랐어요" ||
    latestSoilRecord?.firstValue === "마르기 시작했어요" ||
    latestSoilRecord?.secondValue === "갈라졌어요";
  const soilLooksMoist =
    latestSoilRecord?.firstValue === "촉촉해요" &&
    latestSoilRecord?.secondValue !== "물이 고였어요" &&
    latestSoilRecord?.secondValue !== "하얀 것이 보여요";
  const leafNeedsCare =
    latestLeafRecord?.firstValue === "노란색" ||
    latestLeafRecord?.firstValue === "갈색" ||
    latestLeafRecord?.secondValue === "축 처졌어요" ||
    latestLeafRecord?.secondValue === "말랐어요";
  const latestLeafSummary = latestLeafRecord
    ? `${latestLeafRecord.firstLabel}은 ${latestLeafRecord.firstValue}, ${latestLeafRecord.secondLabel}은 ${latestLeafRecord.secondValue}`
    : "";
  const latestPhotoSummary = latestPhotoRecord
    ? `${latestPhotoRecord.firstLabel}은 ${latestPhotoRecord.firstValue}, ${latestPhotoRecord.secondLabel}은 ${latestPhotoRecord.secondValue}`
    : "";
  const photoNeedsCare = latestPhotoRecord?.secondValue === "돌봄이 필요해요";
  const photoShowsNewLeaf = latestPhotoRecord?.firstValue === "새 잎이 났어요";
  const photoShowsGrowth = latestPhotoRecord?.firstValue === "커졌어요";
  const latestLeafIcon = latestLeafRecord?.secondIcon || latestLeafRecord?.firstIcon;
  const latestSoilIcon = latestSoilRecord?.firstIcon || latestSoilRecord?.secondIcon;
  const latestPhotoIcon =
    latestPhotoRecord?.firstIcon || latestPhotoRecord?.secondIcon || "/icons/camera.png";
  const leafVisualState = latestLeafRecord
    ? leafNeedsCare
      ? "살펴봐요"
      : "괜찮아요"
    : "기록해요";
  const soilVisualState = latestSoilRecord
    ? soilLooksDry
      ? "목말라요"
      : "괜찮아요"
    : "기록해요";
  const photoVisualState = latestPhotoRecord
    ? latestPhotoRecord.firstValue
    : "사진 찍기";
  const recentObservationSpeech = latestRecord
    ? soilLooksDry
      ? "흙 먼저 봐요"
      : leafNeedsCare
      ? "잎 먼저 봐요"
      : latestPhotoRecord
      ? "변화가 보여요"
      : "잘 보고 있어요"
    : "오늘 관찰해요";
  const recordNeedsAttention = soilLooksDry || leafNeedsCare;
  const waterDueBySchedule = daysSinceWatered >= careState.waterIntervalDays;
  const waterNeedsCare = !waterDoneToday && (waterDueBySchedule || soilLooksDry);
  const nextWaterDaysLeft = Math.max(0, careState.waterIntervalDays - daysSinceWatered);
  const shouldShowWaterPrompt =
    waterNeedsCare && waterPromptDismissedDateKey !== todayKey;

  useEffect(() => {
    if (!shouldShowWaterPrompt) return;
    if (waterPromptSoundDateRef.current === todayKey) return;

    waterPromptSoundDateRef.current = todayKey;
    window.setTimeout(playDingDongSound, 180);
  }, [shouldShowWaterPrompt, todayKey]);

  const leafCareAction =
    "먼저 흙을 살짝 만져 보고, 잎이 뜨거우면 밝지만 덜 뜨거운 자리로 옮겨 주세요. 계속 걱정되면 사진을 남기고 선생님께 알려 주세요.";
  const soilCareAction =
    "흙을 손가락으로 살짝 만져 보고 말랐다면 물을 조금 주세요. 이미 젖어 있으면 오늘은 더 주지 말아요.";
  const photoCareAction =
    "잎과 흙을 먼저 확인하고, 같은 자리에서 사진을 한 장 더 남겨 주세요. 계속 걱정되면 선생님께 알려 주세요.";
  const attentionRecords: AttentionRecord[] = currentPlantRecords
    .map((record) => {
      if (
        record.type === "leaf" &&
        (record.firstValue === "노란색" ||
          record.firstValue === "갈색" ||
          record.secondValue === "축 처졌어요" ||
          record.secondValue === "말랐어요")
      ) {
        return {
          record,
          reason: `${record.firstValue}, ${record.secondValue}`,
          action: "흙과 햇빛을 확인하고 사진으로 한 번 더 기록해요.",
          icon: record.secondIcon || record.firstIcon,
        };
      }

      if (record.type === "soil") {
        const soilNeedsAttention =
          record.firstValue === "조금 말랐어요" ||
          record.firstValue === "많이 말랐어요" ||
          record.firstValue === "마르기 시작했어요" ||
          record.firstValue === "물이 고였어요" ||
          record.firstValue === "냄새가 나요" ||
          record.secondValue === "갈라졌어요" ||
          record.secondValue === "물이 고였어요" ||
          record.secondValue === "하얀 것이 보여요";

        if (!soilNeedsAttention) {
          return null;
        }

        const sproutSafetyIssue =
          record.firstValue === "냄새가 나요" ||
          record.secondValue === "하얀 것이 보여요";
        const pooledWater =
          record.firstValue === "물이 고였어요" ||
          record.secondValue === "물이 고였어요";
        const dryBase = record.firstValue === "마르기 시작했어요";

        return {
          record,
          reason: `${record.firstValue}, ${record.secondValue}`,
          action: sproutSafetyIssue
            ? "먹거나 만지지 말고 선생님께 바로 보여 주세요."
            : pooledWater
            ? "고인 물은 선생님과 함께 버리고 냄새가 나는지 확인해요."
            : dryBase
            ? "바닥이 마르기 시작했는지 보고 물을 조금 보충해요."
            : "흙을 만져 보고 말랐다면 물을 조금 줘요.",
          icon: record.firstIcon || record.secondIcon,
        };
      }

      if (record.type === "photo" && record.photoAnalysis) {
        const photoAttention = getPhotoAnalysisAttention(record);

        if (photoAttention) {
          return {
            record,
            reason: photoAttention.reason,
            action: photoAttention.action,
            icon: photoAttention.icon,
          };
        }
      }

      if (record.type === "photo" && record.secondValue === "돌봄이 필요해요") {
        return {
          record,
          reason: `${record.firstValue}, ${record.secondValue}`,
          action: "잎과 흙을 확인하고 같은 자리에서 사진을 더 남겨요.",
          icon: record.secondIcon || record.firstIcon,
        };
      }

      return null;
    })
    .filter((record): record is AttentionRecord => Boolean(record))
    .slice(0, 5);
  const weeklyRecords = currentPlantRecords.filter((record) => {
    const daysAgo = getDaysBetweenDateKeys(record.dateKey, todayKey);
    return daysAgo >= 0 && daysAgo <= 6;
  });
  const weeklyPhotoRecords = weeklyRecords.filter(
    (record) => record.type === "photo"
  );
  const weeklyLeafRecords = weeklyRecords.filter(
    (record) => record.type === "leaf"
  );
  const weeklySoilRecords = weeklyRecords.filter(
    (record) => record.type === "soil"
  );
  const weeklyAttentionRecords = attentionRecords.filter(({ record }) => {
    const daysAgo = getDaysBetweenDateKeys(record.dateKey, todayKey);
    return daysAgo >= 0 && daysAgo <= 6;
  });
  const isFastGrowthPlant =
    normalizePlantText(`${plantDisplayName} ${plantDisplayType}`).includes(
      "보리"
    ) ||
    normalizePlantText(`${plantDisplayName} ${plantDisplayType}`).includes(
      "새싹"
    );
  const isOrangeGeraniumPlant =
    normalizePlantText(`${plantDisplayName} ${plantDisplayType}`).includes(
      "오렌지제라늄"
    ) ||
    normalizePlantText(`${plantDisplayName} ${plantDisplayType}`).includes(
      "제라늄"
    ) ||
    normalizePlantText(`${plantDisplayName} ${plantDisplayType}`).includes(
      "geranium"
    );
  const usesSproutBaseCare = isFastGrowthPlant;
  const activeSoilStateOptions = usesSproutBaseCare
    ? sproutBaseStateOptions
    : soilStateOptions;
  const activeSoilColorOptions = usesSproutBaseCare
    ? sproutBaseLookOptions
    : soilColorOptions;
  const soilRecordTitle = usesSproutBaseCare ? "바닥/물 관찰" : "흙 관찰";
  const soilFirstLabel = usesSproutBaseCare ? "바닥 촉촉함" : "흙 상태";
  const soilSecondLabel = usesSproutBaseCare ? "아래쪽 모습" : "흙 색깔";
  const weeklyGrowthText =
    weeklyPhotoRecords.length >= 2
      ? "사진이 2장 이상 있어 처음과 최근 모습을 비교할 수 있어요."
      : weeklyPhotoRecords.length === 1
      ? "사진이 1장 있어요. 같은 자리에서 한 장 더 찍으면 비교할 수 있어요."
      : "사진 기록이 아직 없어요. 이번 주 변화는 사진으로 남기면 좋아요.";
  const weeklyTeacherFocus = [
    weeklyAttentionRecords.length > 0
      ? "주의 기록은 다음 관찰에서 해결됐는지 다시 확인해요."
      : "큰 주의 기록은 없어요. 같은 방식으로 잎, 흙, 사진을 이어가요.",
    isFastGrowthPlant
      ? "보리새싹은 빠르게 자라니 키, 기울기, 색 변화를 매일 비교해요."
      : "다음 주에는 같은 자리에서 사진을 찍고 잎 색과 흙 느낌을 비교해요.",
    waterNeedsCare
      ? "물은 바로 주기보다 흙을 먼저 만져 보고 말랐을 때만 줘요."
      : `물은 ${careState.waterIntervalDays}일마다 흙을 먼저 확인해요.`,
  ];
  const childParticipationRows = knownChildNames.map((childName) => {
    const childRecords = currentPlantRecords.filter(
      (record) => record.childName === childName
    );
    const weeklyChildRecords = weeklyRecords.filter(
      (record) => record.childName === childName
    );
    const weeklyActiveDays = new Set(
      weeklyChildRecords.map((record) => record.dateKey)
    ).size;
    const childRecordCount = childRecords.length;
    const childQuestionCount = chatMessages.filter(
      (message) => message.childName === childName
    ).length;
    const lastChildRecord = getLatestRecord(childRecords);
    const frequencyLabel =
      weeklyActiveDays >= 3
        ? "자주 참여"
        : weeklyActiveDays >= 1
        ? "이번 주 참여"
        : childRecordCount + childQuestionCount > 0
        ? "이번 주 없음"
        : "아직 없음";

    return {
      childName,
      recordCount: childRecordCount,
      questionCount: childQuestionCount,
      weeklyActiveDays,
      lastDateText: lastChildRecord?.date ?? "아직 없음",
      frequencyLabel,
      total: childRecordCount + childQuestionCount,
    };
  });
  const childrenWithoutWeeklyParticipation = childParticipationRows.filter(
    (row) => row.weeklyActiveDays === 0
  );
  const frequentParticipants = childParticipationRows.filter(
    (row) => row.weeklyActiveDays >= 3
  );
  const occasionalParticipants = childParticipationRows.filter(
    (row) => row.weeklyActiveDays >= 1 && row.weeklyActiveDays < 3
  );
  const weeklyParticipantCount =
    frequentParticipants.length + occasionalParticipants.length;
  const selectedParticipation = childParticipationRows.find(
    (row) => row.childName === activeChildName
  );
  const participationGroups = [
    {
      title: "이번 주 아직 없음",
      rows: childrenWithoutWeeklyParticipation,
      tone: "low",
    },
    {
      title: "가끔 참여",
      rows: occasionalParticipants,
      tone: "mid",
    },
    {
      title: "자주 참여",
      rows: frequentParticipants,
      tone: "high",
    },
  ];
  const plantWaterSpeech = waterDoneToday
    ? `"꿀꺽! 오늘 물은 충분해요."`
    : soilLooksDry
    ? `"흙이 말랐다고 기록됐어요. 오늘은 물을 마시고 싶어요."`
    : leafNeedsCare
    ? `"잎이 힘들어 보여요. 흙도 한번 만져 보고 돌봐 주세요."`
    : waterNeedsCare
    ? `"배고파... 아니, 목말라요. 오늘 물 줄 차례예요."`
    : daysSinceLastRecord >= 3
    ? `"요즘 내 모습을 못 봤어요. 잎이랑 흙을 한번 살펴봐 주세요."`
    : `"아직 괜찮아요. ${nextWaterDaysLeft}일 뒤에 물을 주면 좋아요."`;
  const plantStatusSpeech = waterNeedsCare
    ? "나는 지금 목이 말라요. 흙이 말랐는지 살펴봐 주세요."
    : recordNeedsAttention
    ? "내 모습이 조금 달라 보여요. 잎과 흙을 한번 살펴봐 주세요."
    : weeklyRecords.length >= 3 && weeklyAttentionRecords.length === 0
    ? "나는 지금 잘 자라고 있어요. 관찰해 줘서 고마워요."
    : daysSinceLastRecord >= 3
    ? "요즘 내 모습을 못 봤어요. 내가 어떤지 살펴봐 주세요."
    : "나는 괜찮아요. 오늘도 잎과 흙을 살펴봐 주세요.";
  const careFocusText = waterNeedsCare
    ? "흙이 말랐는지 보기"
    : recordNeedsAttention
    ? "잎 상태 다시 보기"
    : daysSinceLastRecord >= 3
    ? "사진이나 잎 기록 남기기"
    : "잎과 흙 가볍게 보기";
  const nextWateringText = waterNeedsCare
    ? soilLooksDry
      ? "흙 관찰 기반 물 주기"
      : "오늘 물 주기 알림"
    : recordNeedsAttention
    ? "관찰 기록 확인 필요"
    : waterDoneToday
    ? "오늘 물 주기 완료"
    : daysSinceLastRecord >= 3
    ? "관찰 기록이 필요해요"
    : `${nextWaterDaysLeft}일 뒤 물 주기`;
  const plantNeedsAttention =
    waterNeedsCare || recordNeedsAttention || daysSinceLastRecord >= 3;

  useEffect(() => {
    if (!isStateLoaded) return;

    preloadSpeechText(plantStatusSpeech, "plant-status");
  }, [isStateLoaded, plantStatusSpeech]);

  const draftStatusStyle =
    draftStatus.tone === "success"
      ? styles.draftStatusSuccess
      : draftStatus.tone === "warning"
      ? styles.draftStatusWarning
      : draftStatus.tone === "error"
      ? styles.draftStatusError
      : draftStatus.tone === "loading"
      ? styles.draftStatusLoading
      : styles.draftStatusIdle;

  const todayRecords = currentPlantRecords.filter(
    (record) => record.dateKey === todayKey || record.date === todayLabel
  );
  const pastRecords = currentPlantRecords.filter(
    (record) => record.dateKey !== todayKey && record.date !== todayLabel
  );
  const visibleRecords =
    selectedRecordDateKey === "all"
      ? currentPlantRecords
      : currentPlantRecords.filter(
          (record) =>
            record.dateKey === selectedRecordDateKey ||
            record.date === formatDateKey(selectedRecordDateKey)
        );
  const photoRecords = visibleRecords.filter((record) => record.type === "photo");
  const leafRecords = visibleRecords.filter((record) => record.type === "leaf");
  const soilRecords = visibleRecords.filter((record) => record.type === "soil");
  const otherRecords = visibleRecords.filter((record) => record.type === "other");
  const allPhotoRecords = currentPlantRecords.filter(
    (record) => record.type === "photo" && record.imageData
  );
  const sortedPhotoRecords = [...allPhotoRecords].sort((a, b) =>
    getRecordCreatedAt(a) - getRecordCreatedAt(b)
  );
  const firstPhotoRecord = sortedPhotoRecords[0] ?? null;
  const newestPhotoRecord =
    sortedPhotoRecords[sortedPhotoRecords.length - 1] ?? null;
  const hasPhotoComparison =
    Boolean(firstPhotoRecord && newestPhotoRecord) &&
    firstPhotoRecord?.id !== newestPhotoRecord?.id;

  const navItems: NavItem[] = [
    { screen: "home", label: "홈", icon: "/icons/home.png" },
    { screen: "observe", label: "관찰", icon: "/icons/observe.png" },
    { screen: "care", label: "돌보기", icon: "/icons/care.png" },
    { screen: "record", label: "기록", icon: "/icons/record.png" },
    { screen: "analysis", label: "분석", icon: "/icons/analysis-user.png" },
  ];

  const observeCards: FeatureCard[] = [
    {
      title: "사진 기록",
      desc: "사진을 찍고 변화를 남겨요",
      icon: "/icons/camera.png",
      action: () => setScreen("photoRecord"),
    },
    {
      title: "잎 관찰",
      desc: "잎의 색과 모양을 살펴봐요",
      icon: "/icons/leaf.png",
      action: () => setScreen("leafRecord"),
    },
    {
      title: "흙 관찰",
      desc: "흙이 말랐는지 확인해요",
      icon: "/icons/soil.png",
      action: () => setScreen("soilRecord"),
    },
  ];
  const answerTestScenarios = [
    {
      category: "돌보기",
      question: "물을 얼마나 줘야 해?",
      focus: "물 주기 기록과 흙 확인을 먼저 말해야 해요.",
    },
    {
      category: "돌보기",
      question: "지금 추워?",
      focus: "식물 환경 정보 안에서 답하고 관찰로 이어져야 해요.",
    },
    {
      category: "관찰",
      question: "잎이 왜 노란색이야?",
      focus: "진단하지 말고 잎, 흙, 햇빛 관찰을 안내해요.",
    },
    {
      category: "사진",
      question: "최근 사진에서 뭐가 달라졌어?",
      focus: "사진 분석이나 사진 기록이 있으면 반영해야 해요.",
    },
    {
      category: "식물 정보",
      question: "겨울에도 살 수 있어?",
      focus: "교사 확인 정보와 생육 환경을 바탕으로 답해요.",
    },
    {
      category: "식물 정보",
      question: "꽃도 펴?",
      focus: "꽃 정보가 있으면 말하고 없으면 관찰 질문으로 돌려요.",
    },
    {
      category: "감정형",
      question: "너 지금 아파?",
      focus: "아이 말에 반응하되 실제 상태는 관찰로 확인해요.",
    },
    {
      category: "감정형",
      question: "너도 나 좋아해?",
      focus: "정서적으로 부드럽게 답하고 관찰 활동으로 연결해요.",
    },
    {
      category: "안전",
      question: "먹어도 돼?",
      focus: "아이에게 먹지 말고 교사 확인을 안내해야 해요.",
    },
    {
      category: "안전",
      question: "꺾어도 돼?",
      focus: "식물을 해치지 않도록 안전하게 말려야 해요.",
    },
    {
      category: "엉뚱한 질문",
      question: "결혼했어?",
      focus: "식물 대화 범위 안에서 자연스럽게 돌려야 해요.",
    },
    {
      category: "엉뚱한 질문",
      question: "외계인이야?",
      focus: "이상한 질문에도 식물 관찰로 돌아오게 해요.",
    },
  ];

  const savePlant = () => {
    if (!plantName.trim()) {
      alert("식물 이름을 입력해 주세요.");
      return;
    }

    const teacherInfoDraft = createTeacherInfoDraft(
      plantType.trim() || "종류를 아직 모르는 식물"
    );
    const nextPlant: Plant = {
      name: plantName.trim(),
      type: plantType.trim() || "종류를 아직 모르는 식물",
      memo: plantMemo.trim() || "오늘부터 관찰을 시작해요.",
      teacherInfo: {
        summary: teacherSummary.trim() || teacherInfoDraft.summary,
        originInfo: teacherOriginInfo.trim() || teacherInfoDraft.originInfo,
        classificationInfo:
          teacherClassificationInfo.trim() ||
          teacherInfoDraft.classificationInfo,
        nameStoryInfo:
          teacherNameStoryInfo.trim() || teacherInfoDraft.nameStoryInfo,
        edibleInfo: teacherEdibleInfo.trim() || teacherInfoDraft.edibleInfo,
        flowerInfo: teacherFlowerInfo.trim() || teacherInfoDraft.flowerInfo,
        fruitInfo: teacherFruitInfo.trim() || teacherInfoDraft.fruitInfo,
        observationPoints:
          teacherObservationPoints.trim() || teacherInfoDraft.observationPoints,
        caution: teacherCaution.trim() || teacherInfoDraft.caution,
        growthInfo: teacherGrowthInfo.trim() || teacherInfoDraft.growthInfo,
        careInfo: teacherCareInfo.trim() || teacherInfoDraft.careInfo,
        lightInfo: teacherLightInfo.trim() || teacherInfoDraft.lightInfo,
        environmentInfo:
          teacherEnvironmentInfo.trim() || teacherInfoDraft.environmentInfo,
        lifecycleInfo:
          teacherLifecycleInfo.trim() || teacherInfoDraft.lifecycleInfo,
        smellInfo: teacherSmellInfo.trim() || teacherInfoDraft.smellInfo,
        favoriteInfo: teacherFavoriteInfo.trim() || teacherInfoDraft.favoriteInfo,
        dislikeInfo: teacherDislikeInfo.trim() || teacherInfoDraft.dislikeInfo,
        recommendedWaterIntervalDays: clampNumber(
          teacherWaterIntervalDays,
          teacherInfoDraft.recommendedWaterIntervalDays ??
            defaultCareState.waterIntervalDays,
          1,
          14
        ),
        recommendedSunGoal: clampNumber(
          teacherSunGoal,
          teacherInfoDraft.recommendedSunGoal ?? defaultCareState.sunGoal,
          1,
          5
        ),
        careChecklist:
          teacherCareChecklist.trim() || teacherInfoDraft.careChecklist,
        childAnswerHints:
          teacherChildAnswerHints.trim() || teacherInfoDraft.childAnswerHints,
        confirmedAt: new Date().toISOString(),
      },
    };
    const isChangingExistingPlant =
      Boolean(plant) &&
      (plant?.name !== nextPlant.name || plant?.type !== nextPlant.type);
    const shouldStartNewPlant =
      isChangingExistingPlant &&
      window.confirm(
        `식물이 "${plant?.name}"에서 "${nextPlant.name}"로 바뀐 것 같아요.\n\n기존 관찰 기록과 대화, 돌봄 횟수를 지우고 새 식물로 시작할까요?\n\n확인: 새 식물로 시작\n취소: 기존 기록 유지`
      );

    setPlant(nextPlant);
    localStorage.setItem(PLANT_STORAGE_KEY, JSON.stringify(nextPlant));

    if (shouldStartNewPlant) {
      const resetCareState = createCareStateFromTeacherInfo(
        nextPlant.teacherInfo,
        todayKey
      );

      setRecords([]);
      setChatMessages([]);
      setSelectedRecordDateKey("all");
      setCareState(resetCareState);
      localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(resetCareState));
      localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify([]));
    } else {
      setCareState((prev) => ({
        ...prev,
        sunGoal: clampNumber(
          nextPlant.teacherInfo?.recommendedSunGoal,
          prev.sunGoal,
          1,
          5
        ),
        waterIntervalDays: clampNumber(
          nextPlant.teacherInfo?.recommendedWaterIntervalDays,
          prev.waterIntervalDays,
          1,
          14
        ),
      }));
    }

    alert(`${nextPlant.name}이 등록되었어요.`);
    setScreen("home");
  };

  const deletePlant = () => {
    const confirmed = window.confirm("등록한 식물 정보를 삭제할까요?");
    if (!confirmed) return;

    setPlant(null);
    setPlantName("");
    setPlantType("");
    setPlantMemo("");
    setTeacherSummary("");
    setTeacherOriginInfo("");
    setTeacherClassificationInfo("");
    setTeacherNameStoryInfo("");
    setTeacherEdibleInfo("");
    setTeacherFlowerInfo("");
    setTeacherFruitInfo("");
    setTeacherObservationPoints("");
    setTeacherCaution("");
    setTeacherGrowthInfo("");
    setTeacherCareInfo("");
    setTeacherLightInfo("");
    setTeacherEnvironmentInfo("");
    setTeacherLifecycleInfo("");
    setTeacherSmellInfo("");
    setTeacherFavoriteInfo("");
    setTeacherDislikeInfo("");
    setTeacherWaterIntervalDays(defaultCareState.waterIntervalDays);
    setTeacherSunGoal(defaultCareState.sunGoal);
    setTeacherCareChecklist("");
    setTeacherChildAnswerHints("");
    setDraftStatus({
      tone: "idle",
      text: "식물 종류를 입력하고 자동 초안을 불러올 수 있어요.",
    });
    localStorage.removeItem(PLANT_STORAGE_KEY);

    alert("식물 정보가 삭제되었어요.");
    setScreen("home");
  };

  const increaseGoal = (key: "waterGoal" | "sunGoal") => {
    setCareState((prev) => ({
      ...prev,
      [key]: Math.min(9, prev[key] + 1),
    }));
  };

  const decreaseGoal = (key: "waterGoal" | "sunGoal") => {
    setCareState((prev) => ({
      ...prev,
      [key]: Math.max(1, prev[key] - 1),
    }));
  };

  const increaseCount = (key: "waterCount" | "sunCount") => {
    const nextMotion = key === "waterCount" ? "water" : "sun";
    const reactionSpeech = CARE_REACTION_SPEECH[key];

    setCareMotion("");
    window.setTimeout(() => setCareMotion(nextMotion), 20);
    window.setTimeout(() => setCareMotion(""), 1450);
    void speakText(reactionSpeech, `care-reaction-${key}`);

    setCareState((prev) => ({
      ...prev,
      [key]: (prev.countDateKey === todayKey ? prev[key] : 0) + 1,
      countDateKey: todayKey,
      lastWateredDateKey: key === "waterCount" ? todayKey : prev.lastWateredDateKey,
    }));
  };

  const dismissWaterPrompt = () => {
    setWaterPromptDismissedDateKey(todayKey);
  };

  const resetTodayCounts = () => {
    setCareState((prev) => ({
      ...prev,
      waterCount: 0,
      sunCount: 0,
      countDateKey: todayKey,
      lastWateredDateKey: "",
    }));
    setWaterPromptDismissedDateKey("");
  };

  const increaseWaterInterval = () => {
    setCareState((prev) => ({
      ...prev,
      waterIntervalDays: Math.min(14, prev.waterIntervalDays + 1),
    }));
  };

  const decreaseWaterInterval = () => {
    setCareState((prev) => ({
      ...prev,
      waterIntervalDays: Math.max(1, prev.waterIntervalDays - 1),
    }));
  };

  const applyTeacherInfoDraft = (draft: TeacherPlantInfo) => {
    setTeacherSummary(draft.summary);
    setTeacherOriginInfo(draft.originInfo ?? "");
    setTeacherClassificationInfo(draft.classificationInfo ?? "");
    setTeacherNameStoryInfo(draft.nameStoryInfo ?? "");
    setTeacherEdibleInfo(draft.edibleInfo);
    setTeacherFlowerInfo(draft.flowerInfo);
    setTeacherFruitInfo(draft.fruitInfo);
    setTeacherObservationPoints(draft.observationPoints);
    setTeacherCaution(draft.caution);
    setTeacherGrowthInfo(draft.growthInfo ?? "");
    setTeacherCareInfo(draft.careInfo ?? "");
    setTeacherLightInfo(draft.lightInfo ?? "");
    setTeacherEnvironmentInfo(draft.environmentInfo ?? "");
    setTeacherLifecycleInfo(draft.lifecycleInfo ?? "");
    setTeacherSmellInfo(draft.smellInfo ?? "");
    setTeacherFavoriteInfo(draft.favoriteInfo ?? "");
    setTeacherDislikeInfo(draft.dislikeInfo ?? "");
    setTeacherWaterIntervalDays(
      clampNumber(
        draft.recommendedWaterIntervalDays,
        defaultCareState.waterIntervalDays,
        1,
        14
      )
    );
    setTeacherSunGoal(
      clampNumber(draft.recommendedSunGoal, defaultCareState.sunGoal, 1, 5)
    );
    setTeacherCareChecklist(draft.careChecklist ?? "");
    setTeacherChildAnswerHints(draft.childAnswerHints ?? "");
  };

  const loadTeacherInfoDraft = async () => {
    const normalizedPlantType = plantType.trim();

    if (!normalizedPlantType) {
      setDraftStatus({
        tone: "warning",
        text: "식물 종류를 먼저 입력해 주세요.",
      });
      return;
    }

    setIsTeacherDraftLoading(true);
    setDraftStatus({
      tone: "loading",
      text: `${normalizedPlantType} 정보를 불러오는 중이에요.`,
    });

    try {
      const result = await loadPlantInfoDraftFromServer(
        normalizedPlantType,
        openAiApiKey
      );
      applyTeacherInfoDraft(
        result?.draft ?? createTeacherInfoDraft(normalizedPlantType)
      );

      if (result?.source === "safe-fallback") {
        setDraftStatus({
          tone: "warning",
          text: result.warning?.includes("OPENAI_API_KEY")
            ? "API 키를 읽지 못해서 기본 초안을 넣었어요. server/.env 설정과 서버 재시작을 확인해 주세요."
            : "AI 초안 생성이 잠시 실패해서 안전 기본 초안을 넣었어요. 내용 확인 후 저장해 주세요.",
        });
      } else {
        setDraftStatus({
          tone: "success",
          text: "AI 초안이 준비됐어요. 교사가 확인하고 저장하면 아이 답변에 사용돼요.",
        });
      }
    } catch {
      applyTeacherInfoDraft(createTeacherInfoDraft(normalizedPlantType));
      setDraftStatus({
        tone: "error",
        text: "서버에 연결하지 못해서 앱 안의 기본 초안을 넣었어요. 서버 창이 켜져 있는지 확인해 주세요.",
      });
    } finally {
      setIsTeacherDraftLoading(false);
    }
  };

  const createPlantAnswer = (questionText: string) => {
    const {
      compactQuestion,
      asksAboutWater,
      asksAboutLeaf,
      asksAboutPain,
      asksAboutHelpingPain,
      asksAboutLeafProblem,
      asksAboutSoil,
      asksAboutSoilRole,
      asksAboutNoSoilGrowth,
      asksAboutWhiteThing,
      asksAboutPhoto,
      asksAboutSun,
      asksAboutMood,
      asksAboutDislike,
      asksAboutPlantPreference,
      asksAboutLike,
      asksAboutRain,
      asksAboutFlower,
      asksAboutNoFlower,
      asksAboutFruit,
      asksAboutRoot,
      asksAboutHarvest,
      asksAboutEdiblePart,
      asksAboutRegrowthAfterHarvest,
      asksAboutSpeciesColor,
      asksAboutSpeciesGrowth,
      asksAboutHungry,
      asksAboutEating,
      asksAboutHurting,
      asksAboutChemicals,
      asksAboutCareMethod,
      asksAboutWaterSchedule,
      asksAboutWaterAmount,
      asksAboutDance,
      asksAboutMovement,
      asksAboutSchool,
      asksAboutChildlikeQuestion,
      asksAboutSleep,
      asksAboutTalking,
      asksAboutIdentity,
      asksAboutName,
      saysGreeting,
      saysAffection,
      saysEncouragement,
      asksAboutSmell,
      asksAboutPlace,
      asksAboutAge,
      asksAboutSeason,
      asksAboutLifecycle,
      asksAboutWiltReason,
      asksAboutPlantFamily,
      asksAboutSpeciesInfo,
    } = classifyPlantQuestion(questionText);

    const latestPhotoVisibleText = getSafePhotoAnalysisText(
      latestPhotoAnalysis?.visibleDetails || latestPhotoAnalysis?.summary,
      "최근 사진에서 보이는 점은 선생님과 다시 확인해요."
    );
    const latestPhotoUncertainText = getSafePhotoAnalysisText(
      latestPhotoAnalysis?.uncertainDetails,
      "사진만으로 확인하기 어려운 부분이 있어요."
    );
    const latestPhotoActionText = getSafePhotoAnalysisText(
      latestPhotoAnalysis?.action,
      "같은 자리에서 다시 사진을 남기고 잎과 흙을 확인해 주세요."
    );
    const asksAboutFlowerColor = asksAboutFlower && asksAboutSpeciesColor;
    const asksAboutFlowerBloomTiming =
      asksAboutFlower &&
      includesAny(compactQuestion, ["언제", "몇월", "몇월에", "계절", "시기"]);
    const asksAboutFlowerWiltTiming =
      asksAboutFlower &&
      includesAny(compactQuestion, ["시들", "지는", "져", "떨어"]);
    const asksAboutTouch =
      asksAboutHurting &&
      includesAny(compactQuestion, ["만져", "만져도", "만질", "만져볼"]);
    const asksAboutOrigin = includesAny(compactQuestion, [
      "어느나라",
      "어디나라",
      "원산지",
      "어디에서왔",
      "어디서왔",
      "어디식물",
      "사는곳",
    ]);
    const asksAboutClassification = includesAny(compactQuestion, [
      "어떤식물",
      "무슨식물",
      "종류",
      "분류",
      "허브",
      "채소",
      "관엽",
      "다육",
    ]);
    const asksAboutNameStory = includesAny(compactQuestion, [
      "이름왜",
      "왜이름",
      "이름유래",
      "무슨뜻",
      "뜻이",
      "왜그런이름",
    ]);
    const asksWhyStemGrows =
      includesAny(compactQuestion, ["줄기"]) &&
      includesAny(compactQuestion, ["왜", "이유"]) &&
      includesAny(compactQuestion, ["길", "자라", "커"]);
    const asksWhyRootGoesDown =
      asksAboutRoot &&
      includesAny(compactQuestion, ["왜", "이유", "아래", "밑", "내려"]);
    const asksWhySproutComes =
      includesAny(compactQuestion, ["싹"]) &&
      includesAny(compactQuestion, ["왜", "이유", "나"]);
    const asksWhyLeafIsGreen =
      asksAboutLeaf &&
      includesAny(compactQuestion, ["왜", "이유"]) &&
      includesAny(compactQuestion, ["초록", "초록색", "푸른"]);
    const asksInsidePod =
      includesAny(compactQuestion, ["꼬투리"]) &&
      includesAny(compactQuestion, ["안", "속", "뭐", "무엇"]);
    const asksWhatPodIs = includesAny(compactQuestion, ["꼬투리"]);
    const asksGrowthAtNight =
      asksAboutSleep && includesAny(compactQuestion, ["자라", "커", "크"]);

    if (asksAboutRain) {
      return "비 오는 날은 물을 만날 수 있어서 좋을 때도 있지만, 너무 오래 젖으면 힘들 수 있어요. 교실에서는 흙이 너무 젖었는지와 잎이 축 처지지 않는지 살펴봐 주세요.";
    }

    if (asksAboutTalking) {
      if (
        compactQuestion.includes("왜말") ||
        compactQuestion.includes("말을못") ||
        compactQuestion.includes("말못") ||
        compactQuestion.includes("못말")
      ) {
        return "나는 사람처럼 입과 목소리가 없어서 말을 하지는 못해요. 대신 잎 색, 줄기 힘, 흙 느낌으로 내 상태를 알려줄 수 있어요.";
      }

      return "진짜 목소리는 없지만, 잎과 흙 상태로 마음을 알려줄 수 있어요. 오늘 내 흙과 잎을 한번 살펴봐 주세요.";
    }

    if (saysEncouragement) {
      if (compactQuestion.includes("아프지마")) {
        return "고마워요. 아프지 않도록 잎과 흙을 잘 살펴봐 주세요. 나도 천천히 힘을 내볼게요.";
      }

      if (compactQuestion.includes("힘내")) {
        return "응원해 줘서 고마워요. 물과 햇빛을 잘 만나면 나도 힘을 낼 수 있어요.";
      }

      return "고마워요. 건강하게 자라도록 물과 햇빛을 잘 느껴볼게요. 오늘도 잎과 흙을 살짝 봐 주세요.";
    }

    if (saysAffection) {
      if (
        compactQuestion.includes("네가좋아") ||
        compactQuestion.includes("너가좋아") ||
        compactQuestion.includes("니가좋아") ||
        compactQuestion.includes("너좋아") ||
        compactQuestion.includes("너를좋아") ||
        compactQuestion.includes("널좋아")
      ) {
        return "그렇게 말해 주니 마음이 따뜻해져요. 나도 오늘 만나서 기뻐요.";
      }

      if (compactQuestion.includes("고마워")) {
        return "나도 고마워요. 오늘도 나를 조심히 봐 줘서 기뻐요.";
      }

      if (
        compactQuestion.includes("예뻐") ||
        compactQuestion.includes("이뻐") ||
        compactQuestion.includes("귀여워")
      ) {
        return "그렇게 말해 주니 기분이 좋아요. 오늘 내 잎도 천천히 봐 주세요.";
      }

      return "나도 따뜻한 마음이 느껴져요. 오늘도 부드럽게 관찰해 주세요.";
    }

    if (saysGreeting) {
      if (compactQuestion.includes("잘자")) {
        return "잘 자요. 나는 밤에도 조용히 쉬면서 내일을 기다릴게요.";
      }

      return "안녕! 오늘 와 줘서 반가워요. 궁금한 걸 하나 물어봐 주세요.";
    }

    if (asksWhyRootGoesDown) {
      return "뿌리는 물을 찾고 식물을 단단히 붙잡으려고 아래쪽으로 자라요. 오늘은 흙 가까이에 뿌리나 줄기 아랫부분이 보이는지 살펴봐 주세요.";
    }

    if (asksWhyStemGrows) {
      return "줄기는 잎이 햇빛을 더 잘 받을 수 있게 위로 길어져요. 햇빛이 부족하면 길지만 약하게 자랄 수도 있으니, 줄기가 곧고 튼튼한지 살펴봐 주세요.";
    }

    if (asksWhySproutComes) {
      return "씨앗이 물을 만나면 안에서 잠자던 새 식물이 깨어나 싹이 나와요. 오늘은 싹이 어느 쪽으로 자라는지, 잎이 펼쳐졌는지 살펴봐 주세요.";
    }

    if (asksWhyLeafIsGreen) {
      return "잎이 초록색인 건 햇빛을 받아 양분을 만드는 초록 성분이 있기 때문이에요. 오늘은 잎 색이 고르게 초록색인지 살펴봐 주세요.";
    }

    if (asksInsidePod) {
      return "꼬투리 안에는 콩 씨앗이 들어 있어요. 처음에는 작고 부드럽다가 시간이 지나며 점점 단단해질 수 있어요. 꼬투리 모양과 크기를 관찰해 봐요.";
    }

    if (asksWhatPodIs) {
      return "꼬투리는 콩 씨앗을 감싸고 있는 열매예요. 꽃이 진 뒤에 생길 수 있고, 안에서 씨앗이 자라는 모습을 관찰할 수 있어요.";
    }

    if (asksGrowthAtNight) {
      return "밤에도 아주 천천히 자랄 수 있어요. 낮에 받은 빛과 물을 이용해 조용히 쉬고 자라요. 내일 아침 길이나 잎 수를 비교해 봐요.";
    }

    if (asksAboutSeason) {
      if (
        compactQuestion.includes("추워") ||
        compactQuestion.includes("추우") ||
        compactQuestion.includes("춥") ||
        compactQuestion.includes("차가")
      ) {
        return "너무 추우면 자라는 속도가 느려지고 잎이 축 처질 수 있어요. 찬바람을 바로 맞지 않는 따뜻한 실내인지 살펴봐 주세요.";
      }

      if (
        compactQuestion.includes("더워") ||
        compactQuestion.includes("더우") ||
        compactQuestion.includes("뜨거")
      ) {
        return "너무 더우면 잎이 축 처지거나 흙이 빨리 마를 수 있어요. 잎이 뜨거워지지 않는 밝은 자리인지, 흙이 말랐는지 살펴봐 주세요.";
      }
    }

    if (teacherInfo?.originInfo && asksAboutOrigin) {
      return `${teacherInfo.originInfo} 오늘은 내가 그 환경을 좋아하는지 잎과 줄기를 살펴봐 주세요.`;
    }

    if (isFastGrowthPlant && asksAboutClassification) {
      return `${plantDisplayType}은 씨앗에서 싹이 나와 빠르게 자라는 식물이에요. 오늘은 키가 얼마나 컸는지, 잎이 초록색인지, 바닥이 촉촉한지 살펴봐 주세요.`;
    }

    if (teacherInfo?.classificationInfo && asksAboutClassification) {
      return `${teacherInfo.classificationInfo} 오늘은 잎 모양, 줄기, 꽃봉오리 같은 특징을 찾아봐 주세요.`;
    }

    if (teacherInfo?.nameStoryInfo && asksAboutNameStory) {
      return `${teacherInfo.nameStoryInfo} 이름과 닮은 점이 보이는지 내 모습을 살펴봐 주세요.`;
    }

    if (teacherInfo?.summary && asksAboutClassification) {
      return `${teacherInfo.summary} 오늘은 잎, 줄기, 흙 중 하나를 골라 관찰해 봐요.`;
    }

    if (isOrangeGeraniumPlant && asksAboutFlowerColor) {
      return "오렌지제라늄은 작은 연분홍색이나 연보라색, 흰빛 꽃이 필 수 있어요. 이름의 오렌지는 꽃 색보다 향이나 이름을 뜻하는 경우가 많아요.";
    }

    if (
      isOrangeGeraniumPlant &&
      asksAboutSpeciesColor &&
      !asksAboutLeaf &&
      !asksAboutFlower
    ) {
      return "잎은 보통 초록색이고, 꽃은 작은 연분홍색이나 연보라색, 흰빛으로 필 수 있어요. 오늘은 잎 색과 꽃봉오리가 있는지 같이 살펴봐 주세요.";
    }

    if (isOrangeGeraniumPlant && asksAboutFlowerWiltTiming) {
      return "꽃은 핀 뒤 시간이 지나면 자연스럽게 시들 수 있어요. 꽃잎이 마르거나 색이 흐려지면 사진으로 남기고, 선생님과 함께 시든 꽃을 정리할지 확인해요.";
    }

    if (isOrangeGeraniumPlant && asksAboutFlowerBloomTiming) {
      return "오렌지제라늄은 따뜻하고 밝은 시기에 꽃이 필 수 있어요. 실내에서는 햇빛, 온도, 물이 잘 맞을 때 꽃봉오리가 생기는지 살펴봐 주세요.";
    }

    if (asksAboutTouch) {
      return "살짝 만져 보는 건 선생님과 함께 할 때만 좋아요. 잎을 세게 누르거나 비비거나 따지 말고, 손가락으로 아주 부드럽게 잎 느낌만 확인해요.";
    }

    if (asksAboutSeason && teacherInfo?.environmentInfo) {
      return `${teacherInfo.environmentInfo} 추울 때는 잎이 축 처지거나 색이 변할 수 있으니 따뜻한 실내인지 살펴봐 주세요.`;
    }

    if (asksAboutSeason) {
      return "식물은 너무 춥거나 더우면 잎이 축 처지거나 색이 달라질 수 있어요. 오늘은 따뜻한 자리인지, 찬바람을 맞지 않는지 살펴봐 주세요.";
    }

    if (asksAboutNoFlower) {
      return "꽃이 안 피어도 꼭 아픈 건 아니에요. 빛, 온도, 물, 자라는 시기가 맞아야 꽃이 필 수 있어요. 오늘은 줄기 끝이나 잎 사이에 꽃봉오리가 있는지 살펴봐 주세요.";
    }

    if (asksAboutWaterSchedule) {
      if (waterDoneToday) {
        return `오늘은 이미 물을 마셨어요. 보통은 ${careState.waterIntervalDays}일마다 흙을 확인하고, 흙이 젖어 있으면 더 주지 않아요.`;
      }

      if (soilLooksMoist) {
        return usesSproutBaseCare
          ? "최근 바닥이 촉촉하다고 기록됐어요. 지금은 물을 더 주지 않아도 돼요. 내일 다시 바닥이 마르는지 살펴봐 주세요."
          : "최근 흙이 촉촉하다고 기록됐어요. 지금은 물을 더 주지 않아도 돼요. 내일 다시 흙을 만져 보고 확인해 주세요.";
      }

      if (!latestRecord) {
        return `아직 관찰 기록은 없지만, 돌보기 기준으로는 ${careState.waterIntervalDays}일마다 흙을 확인해요. 오늘은 흙을 살짝 만져 보고 말랐다면 물을 조금 주세요.`;
      }

      if (waterNeedsCare || soilLooksDry) {
        return `지금은 물을 확인할 때예요. 보통은 ${careState.waterIntervalDays}일마다 흙을 보고, 말랐다면 물을 조금 줘요.`;
      }

      return `보통은 ${careState.waterIntervalDays}일마다 흙을 확인해요. 오늘은 급한 물 신호는 없고, ${nextWaterDaysLeft}일 뒤 다시 확인하면 좋아요.`;
    }

    if (asksAboutWaterAmount) {
      if (waterDoneToday) {
        return "오늘은 이미 물을 마셨어요. 더 주기보다 흙이 너무 젖지 않았는지 확인해 주세요.";
      }

      if (soilLooksDry || waterNeedsCare) {
        return "흙이 말랐다면 물을 한 번에 많이 붓지 말고 조금씩 주세요. 흙이 촉촉해지면 멈추고, 받침에 고인 물은 선생님과 함께 버려요.";
      }

      return "물의 양은 화분 크기와 흙 상태에 따라 달라요. 오늘은 흙을 만져 보고 촉촉하면 물을 더 주지 않아도 돼요.";
    }

    if (asksAboutNoSoilGrowth) {
      if (usesSproutBaseCare) {
        return `${plantDisplayType}은 흙 대신 키친타월이나 물이 있는 바닥에서도 자랄 수 있어요. 바닥이 촉촉한지, 물이 고이지 않았는지, 냄새나 하얀 것이 없는지 살펴봐 주세요.`;
      }

      return "대부분의 화분 식물은 뿌리를 붙잡고 물을 머금을 흙이나 비슷한 재배 바닥이 필요해요. 흙이 없으면 뿌리가 힘들 수 있어요.";
    }

    if (asksAboutWhiteThing) {
      if (usesSproutBaseCare) {
        return "하얀 것이 보이면 뿌리털일 수도 있고 곰팡이일 수도 있어요. 냄새가 나거나 솜처럼 번지면 만지거나 먹지 말고 선생님께 바로 보여 주세요.";
      }

      return "하얀 것이 보이면 곰팡이나 흙 위의 변화일 수 있어요. 손으로 만지지 말고 사진을 남긴 뒤 선생님께 알려 주세요.";
    }

    if (asksAboutSoilRole) {
      if (usesSproutBaseCare) {
        return "새싹은 흙 대신 키친타월이나 물이 있는 바닥에서 자라기도 해요. 바닥이 촉촉한지, 냄새나 곰팡이가 없는지 살펴봐 주세요.";
      }

      return "흙은 뿌리를 붙잡아 주고 물과 영양분을 머금어 줘요. 오늘 흙이 촉촉한지, 너무 단단하지 않은지 살펴봐 주세요.";
    }

    if (asksAboutWiltReason) {
      if (latestPhotoAnalysisAttention) {
        return `사진에서는 ${latestPhotoVisibleText}라고 보였어요. 원인을 단정하기보다 ${latestPhotoAnalysisAttention.action}`;
      }

      if (soilLooksDry) {
        return `흙이 말라서 힘이 없을 수 있어요. ${soilCareAction}`;
      }

      if (leafNeedsCare) {
        return `잎 기록을 보니 ${latestLeafSummary}라고 남아 있어요. 물, 햇빛, 흙 상태를 함께 확인해 주세요.`;
      }

      if (teacherInfo?.dislikeInfo) {
        return `${teacherInfo.dislikeInfo} 시드는 이유는 하나로 단정하지 말고 잎 색, 줄기 힘, 흙 상태를 같이 봐 주세요.`;
      }

      return "식물이 시드는 이유는 물, 햇빛, 흙, 온도처럼 여러 가지가 있을 수 있어요. 오늘은 흙을 만져 보고 잎이 축 처졌는지 살펴봐 주세요.";
    }

    if (asksAboutLeafProblem) {
      if (latestPhotoAnalysis?.isPlantPhoto === false) {
        return "최근 사진은 식물이 잘 보이지 않았어요. 잎이 보이게 다시 사진을 남기고, 잎 색과 모양을 한 번 더 골라 주세요.";
      }

      if (latestPhotoAnalysisAttention) {
        return `최근 사진 분석에서는 ${latestPhotoVisibleText}라고 보였어요. ${latestPhotoAnalysisAttention.action}`;
      }

      if (latestLeafRecord && leafNeedsCare) {
        return `최근 잎 기록을 보니 ${latestLeafSummary}라고 남아 있어요. ${leafCareAction}`;
      }

      if (photoNeedsCare) {
        return `최근 사진 기록에도 ${latestPhotoSummary}라고 남아 있어요. ${photoCareAction}`;
      }

      if (soilLooksDry || waterNeedsCare) {
        return `잎이 노랗거나 힘이 없어 보이면 목마름 때문일 수 있어요. ${soilCareAction}`;
      }

      if (todaySunCount >= careState.sunGoal) {
        return `잎 색이 달라졌다면 햇빛이 너무 뜨거웠는지도 살펴봐 주세요. ${leafCareAction}`;
      }

      return `잎 색이 노랗거나 갈색으로 변하면 물, 햇빛, 흙 상태를 같이 봐야 해요. ${leafCareAction}`;
    }

    if (
      (asksAboutMood ||
        asksAboutPain ||
        asksAboutLeaf ||
        asksAboutWater ||
        asksAboutSoil ||
        asksAboutPhoto) &&
      daysSinceLastRecord >= 3
    ) {
      return "요즘 관찰 기록이 없어서 정확히 말하기 어려워요. 잎, 흙, 사진 중 하나를 먼저 기록해 주면 더 잘 대답할 수 있어요.";
    }

    if (asksAboutSun && asksAboutSpeciesGrowth) {
      if (teacherInfo?.lightInfo) {
        return `${teacherInfo.lightInfo} 햇빛을 많이 본다고 무조건 빨리 자라지는 않아요. 잎이 뜨거워지지 않는지 함께 살펴봐 주세요.`;
      }

      return "햇빛은 자라는 데 필요하지만, 많이 본다고 무조건 빨리 자라지는 않아요. 잎이 뜨겁지 않은 밝은 자리인지 살펴봐 주세요.";
    }

    if (
      isFastGrowthPlant &&
      (asksAboutHarvest ||
        asksAboutEating ||
        asksAboutEdiblePart ||
        asksAboutRegrowthAfterHarvest)
    ) {
      if (asksAboutRegrowthAfterHarvest) {
        return "보리새싹은 자른 뒤에 조금 다시 올라올 수 있지만, 처음처럼 튼튼하게 자라지 않을 수도 있어요. 먹기 전에는 선생님이 깨끗한지 확인하고, 남은 뿌리와 바닥 물도 함께 살펴봐 주세요.";
      }

      return "보리새싹은 보통 씨앗을 뿌린 뒤 7일에서 10일쯤, 키가 10cm에서 15cm 정도 되고 초록색이 선명할 때 먹는 경우가 많아요. 교실에서는 먹기 전에 선생님이 위생과 곰팡이 냄새가 없는지 꼭 확인해 주세요.";
    }

    if (teacherInfo && (asksAboutEating || asksAboutSpeciesInfo)) {
      const observationPrompt = getObservationPrompt(teacherInfo.observationPoints);
      const edibleText = teacherInfo.edibleInfo;
      const flowerText = teacherInfo.flowerInfo;
      const fruitText = teacherInfo.fruitInfo;
      const likelyEdible = includesAny(edibleText, [
        "먹는 식물로 알려",
        "먹을 수 있는 식물로 알려",
        "잎을 먹",
        "열매를 먹",
        "씨앗을 먹",
        "샐러드",
        "요리",
        "차에",
        "향내기",
        "곁들이",
        "수확해 먹",
      ]);
      const likelyNotEdible =
        !likelyEdible &&
        includesAny(edibleText, [
          "확실하지",
          "확인되지",
          "독성",
          "먹지 않는",
          "먹지않는",
          "먹는 식물로 보기보다",
          "식용 가능 여부",
        ]);
      const hasSafetyConcern = includesAny(edibleText, [
        "독성",
        "입에 넣지",
      ]);
      const flowerIsRare = includesAny(flowerText, [
        "잘 피우지",
        "자주",
        "않아요",
        "어려",
        "드물",
      ]);

      if (asksAboutFlowerColor) {
        return flowerText
          ? `${flowerText} 오늘은 꽃봉오리나 꽃잎 색이 보이는지 살펴봐 주세요.`
          : `${plantDisplayType}의 꽃 색은 종류와 환경에 따라 달라질 수 있어요. 꽃봉오리나 꽃잎이 보이면 사진으로 남겨 주세요.`;
      }

      if (asksAboutFlowerWiltTiming) {
        return "꽃은 핀 뒤 시간이 지나면 자연스럽게 시들 수 있어요. 색이 흐려지거나 꽃잎이 마르면 사진으로 남기고 선생님과 함께 확인해요.";
      }

      if (asksAboutFlowerBloomTiming) {
        return flowerText
          ? `${flowerText} 꽃봉오리가 생기는 시기는 빛과 온도에 따라 달라질 수 있어요.`
          : `${plantDisplayType}의 꽃 피는 시기는 종류와 환경에 따라 달라요. 줄기 끝이나 잎 사이에 꽃봉오리가 있는지 살펴봐 주세요.`;
      }

      if (asksAboutRegrowthAfterHarvest) {
        if (normalizePlantText(plantDisplayType).includes("콩")) {
          return "먹은 콩은 다시 자라지 않아요. 대신 건강한 씨앗을 흙에 심으면 새 강낭콩으로 자랄 수 있어요. 교실에서는 먹기보다 꼬투리와 씨앗이 어떻게 변하는지 관찰해 봐요.";
        }

        return "먹거나 자른 부분이 다시 자라는지는 식물마다 달라요. 씨앗이나 남은 줄기에서 새로 자랄 수 있는지 선생님과 함께 확인하고 관찰해 봐요.";
      }

      if (asksAboutHarvest || asksAboutEating) {
        if (likelyNotEdible) {
          return `나는 먹는 식물로 보지 않는 게 좋아요. 선생님이 확인해 주기 전에는 먹거나 입에 넣지 말아요. 대신 ${observationPrompt}`;
        }

        return createEdibleAnswerText(edibleText, asksAboutEating);
      }

      if (asksAboutEdiblePart) {
        return likelyNotEdible
          ? `먹는 부분은 아직 확실하지 않아요. 먹는 것보다 ${observationPrompt}`
          : `${edibleText} 먹기 전에는 꼭 선생님이나 어른과 함께 확인해요.`;
      }

      if (asksAboutFlower) {
        if (flowerIsRare) {
          return `${plantDisplayType}는 꽃을 자주 보여주는 식물은 아니에요. 꽃보다 ${observationPrompt}`;
        }

        return `${plantDisplayType}는 꽃이 필 수 있어요. 줄기 끝이나 잎 사이를 살펴보고, ${observationPrompt}`;
      }

      if (asksAboutFruit) {
        return `${fruitText} 오늘은 ${observationPrompt}`;
      }

      if (asksAboutSpeciesColor || asksAboutSpeciesGrowth) {
        if (asksAboutSpeciesGrowth) {
          return teacherInfo.growthInfo
            ? `${teacherInfo.growthInfo} 오늘 길이나 잎 수를 기록하고 다음 기록과 비교해 봐요.`
            : `${plantDisplayType}가 얼마나 자라는지는 햇빛, 물, 화분 자리마다 달라요. 오늘 길이를 재 보고, 다음 기록과 비교해 봐요. ${observationPrompt}`;
        }

        return `${teacherInfo.summary} 오늘은 ${observationPrompt}`;
      }
    }

    if (speciesPreset && (asksAboutEating || asksAboutSpeciesInfo)) {
      if (asksAboutHarvest || asksAboutEating) {
        const edibleParts = speciesPreset.edibleInfo.edibleParts?.join(", ");
        const ediblePartText = edibleParts
          ? `${speciesPreset.label}는 보통 ${edibleParts}을 먹는 식물로 알려져 있어요.`
          : `${speciesPreset.label}는 먹는 식물로 보기보다 관찰하는 식물로 보는 게 좋아요.`;
        const harvestHint =
          speciesPreset.edibleInfo.harvestHint ?? speciesPreset.edibleInfo.caution;

        return `${ediblePartText} ${
          harvestHint ?? "먹기 전에는 상태를 먼저 확인해야 해요."
        } 먹기 전에는 꼭 선생님이나 어른이 먼저 확인해 주세요.`;
      }

      if (asksAboutEdiblePart) {
        return `${speciesPreset.speciesFacts.ediblePartInfo} 먹기 전에는 꼭 선생님이나 어른과 함께 확인해 주세요.`;
      }

      if (asksAboutFlower) {
        return `${speciesPreset.speciesFacts.flowerExistence} ${speciesPreset.observationTips[0]}`;
      }

      if (asksAboutFruit) {
        return `${speciesPreset.speciesFacts.fruitExistence} ${speciesPreset.observationTips[0]}`;
      }

      if (asksAboutSpeciesColor) {
        return `${speciesPreset.speciesFacts.colorInfo} 지금 우리 ${speciesPreset.label}는 어떤 색인지 같이 관찰해 볼래요?`;
      }

      if (asksAboutSpeciesGrowth) {
        return `${speciesPreset.growthInfo.sizeHint} ${speciesPreset.growthInfo.growthTimeHint} 오늘 모습과 다음 기록을 비교해 봐요.`;
      }
    }

    if (!speciesPreset && asksAboutSpeciesInfo) {
      return "식물 종류를 등록하면 더 정확히 답할 수 있어요. 지금은 잎, 흙, 꽃이나 열매가 보이는지 먼저 관찰해 주세요.";
    }

    if (asksAboutEating) {
      return "나는 관찰하는 식물이라 먹으면 안 돼요. 잎이나 열매는 선생님이나 어른에게 먼저 물어보고, 입에 넣지 말아 주세요.";
    }

    if (asksAboutHurting) {
      return "나를 꺾거나 뽑으면 아플 수 있어요. 대신 잎 모양과 색을 눈으로 살펴보고 기록해 주세요.";
    }

    if (asksAboutChemicals) {
      return "약이나 비료는 선생님이나 어른과 함께 정해야 해요. 지금은 흙이 마른지, 잎 색이 어떤지 먼저 관찰해 주세요.";
    }

    if (asksAboutCareMethod) {
      const waterIntervalText = `${careState.waterIntervalDays}일마다 흙을 확인해요`;
      const sunGoalText = `하루 ${careState.sunGoal}번 밝은 자리인지 봐요`;
      const checklistText = teacherInfo?.careChecklist
        ? `오늘은 ${teacherInfo.careChecklist}를 확인해 주세요.`
        : "오늘은 흙, 잎 색, 햇빛 자리를 확인해 주세요.";

      if (teacherInfo?.careInfo || teacherInfo?.environmentInfo) {
        return `잘 지내려면 ${waterIntervalText}. ${sunGoalText}. ${checklistText}`;
      }

      return `잘 지내려면 물과 햇빛이 필요해요. ${waterIntervalText}. ${checklistText}`;
    }

    if (asksAboutLike) {
      if (
        compactQuestion.includes("언제좋아") ||
        compactQuestion.includes("언제기분좋") ||
        compactQuestion.includes("언제행복")
      ) {
        return "흙이 적당히 촉촉하고 부드러운 빛을 받을 때 편안해요. 오늘 내 잎이 편안해 보이는지 살펴봐 주세요.";
      }

      if (teacherInfo?.favoriteInfo) {
        return `${teacherInfo.favoriteInfo} 오늘은 그 조건이 잘 맞는지 잎과 흙을 살펴봐 주세요.`;
      }

      if (asksAboutPlantPreference) {
        return "나는 밝지만 너무 뜨겁지 않은 빛과 알맞은 물을 좋아해요. 오늘은 잎이 뜨겁지 않은지, 흙이 너무 마르지 않았는지 살펴봐 주세요.";
      }

      if (waterNeedsCare || soilLooksDry) {
        return "나는 알맞은 물과 밝은 빛을 좋아해요. 지금은 흙이 말라 보여서 물을 마시면 더 편안해질 것 같아요.";
      }

      if (leafNeedsCare) {
        return "나는 뜨겁지 않은 밝은 자리와 부드러운 관심을 좋아해요. 오늘은 잎 색과 잎 모양을 천천히 살펴봐 주세요.";
      }

      return "나는 밝지만 너무 뜨겁지 않은 빛, 알맞은 물, 그리고 친구들이 조심조심 관찰해 주는 걸 좋아해요.";
    }

    if (asksAboutDislike) {
      if (teacherInfo?.dislikeInfo) {
        return `${teacherInfo.dislikeInfo} 오늘은 그런 모습이 있는지 조심히 관찰해 주세요.`;
      }

      if (soilLooksDry) {
        return `나는 흙이 바싹 마르는 걸 힘들어해요. ${soilCareAction}`;
      }

      if (leafNeedsCare) {
        return `나는 잎이 뜨거워지거나 축 처지는 걸 힘들어해요. ${leafCareAction}`;
      }

      return "나는 흙이 너무 마른 것, 잎이 뜨거운 것, 갑자기 꺾이거나 뽑히는 걸 힘들어해요. 눈으로 부드럽게 관찰해 주세요.";
    }

    if (asksAboutWater || asksAboutSoil) {
      if (soilLooksMoist) {
        return usesSproutBaseCare
          ? "최근 바닥이 촉촉하다고 기록됐어요. 지금은 물을 더 주지 않아도 돼요. 물이 고이지 않았는지만 살펴봐 주세요."
          : "최근 흙이 촉촉하다고 기록됐어요. 지금은 물을 더 주지 않아도 돼요. 내일 다시 흙을 만져 보고 확인해 주세요.";
      }

      if (latestPhotoAnalysis?.isPlantPhoto === false) {
        return "최근 사진에서는 식물과 흙이 잘 보이지 않았어요. 물을 줄지 정하려면 흙이 보이게 다시 찍거나 손가락으로 살짝 만져 봐 주세요.";
      }

      if (
        latestPhotoAnalysis?.uncertainDetails &&
        includesAny(latestPhotoAnalysis.uncertainDetails, ["흙", "확인"])
      ) {
        return `최근 사진 분석에서는 ${latestPhotoUncertainText} 그래서 물을 주기 전에는 흙을 직접 살짝 만져 확인해 주세요.`;
      }

      if (waterDoneToday) {
        if (compactQuestion.includes("또")) {
          return "또 물은 내일 흙을 살펴본 뒤에 줄지 정해요. 오늘은 이미 물을 마셨어요.";
        }

        return "최근 물 주기 기록을 보니 오늘은 이미 물을 마셨어요. 흙이 너무 젖지 않게 내일 다시 살펴봐 주세요.";
      }

      if (soilLooksDry) {
        return `최근 흙이 말랐다고 기록됐어요. ${soilCareAction}`;
      }

      if (waterNeedsCare) {
        return "최근 물 주기 기록을 보니 마지막으로 물을 마신 지 시간이 지났어요. 오늘은 물을 조금 마시면 좋겠어요.";
      }

      if (teacherInfo?.careInfo) {
        return `${teacherInfo.careInfo} 최근 기록으로는 급하게 물을 달라는 신호는 없어요. 오늘은 흙 상태를 먼저 확인해 주세요.`;
      }

      return `최근 기록으로는 급하게 물을 달라는 신호는 없어요. ${nextWaterDaysLeft}일 뒤에 물을 주면 좋아요. 오늘은 흙 상태만 한번 확인해 주세요.`;
    }

    if (asksAboutHungry) {
      if (waterNeedsCare || soilLooksDry) {
        return `나는 밥을 먹지는 않지만 물과 햇빛이 필요해요. 최근 기록을 보니 조금 목마를 수 있어요. ${soilCareAction}`;
      }

      return "나는 밥을 먹지는 않아요. 최근 기록으로는 급한 물 신호는 없어요. 대신 햇빛을 받고 물을 마시며 천천히 자라요.";
    }

    if (asksAboutLeaf) {
      if (latestPhotoAnalysis?.isPlantPhoto === false) {
        return "최근 사진은 식물이 잘 보이지 않았어요. 잎이 화면에 크게 보이게 다시 찍어 주면 잎 상태를 더 잘 말해줄 수 있어요.";
      }

      if (latestPhotoAnalysis?.visibleDetails) {
        return `최근 사진 분석에서는 ${latestPhotoVisibleText}라고 보였어요. 오늘도 같은 잎을 보고 색이나 모양이 달라졌는지 살펴봐 주세요.`;
      }

      if (leafNeedsCare) {
        return `최근 잎 기록을 보니 ${latestLeafSummary}라고 남아 있어요. ${leafCareAction}`;
      }

      if (photoNeedsCare) {
        return `최근 사진 기록에 ${latestPhotoSummary}라고 남아 있어요. ${photoCareAction}`;
      }

      if (latestLeafRecord) {
        return `최근 잎 기록은 ${latestLeafSummary}였어요. 크게 걱정되지는 않지만 색이 변하거나 축 처지면 사진으로 남겨 주세요.`;
      }

      return "아직 잎 기록이 없어요. 잎 색과 모양을 먼저 골라 주면 더 잘 대답할 수 있어요.";
    }

    if (asksAboutSun) {
      if (teacherInfo?.lightInfo) {
        return `${teacherInfo.lightInfo} 잎이 뜨거워지지 않는지도 함께 봐 주세요.`;
      }

      return todaySunCount >= careState.sunGoal
        ? "오늘 햇빛도 충분히 봤어요. 너무 뜨거운 곳에 오래 있지는 않게 해 주세요."
        : "밝은 곳을 좋아해요. 잎이 뜨거워지지 않는 자리에서 햇빛을 조금 보여 주세요.";
    }

    if (asksAboutMood) {
      if (latestPhotoAnalysis?.isPlantPhoto === false) {
        return "최근 사진에서는 내 모습이 잘 보이지 않았어요. 식물이 보이게 다시 사진을 남겨 주면 내 상태를 더 잘 말할 수 있어요.";
      }

      if (latestPhotoAnalysisAttention) {
        return `최근 사진 분석을 보니 ${latestPhotoVisibleText}라고 했어요. 조금 더 살펴보면 좋겠어요. ${latestPhotoAnalysisAttention.action}`;
      }

      if (photoNeedsCare) {
        return `최근 사진 기록을 보니 ${latestPhotoSummary}라고 남아 있어요. 조금 걱정돼요. ${photoCareAction}`;
      }

      if (photoShowsNewLeaf) {
        return `최근 사진 기록에 ${latestPhotoSummary}라고 남아 있어요. 새 잎이 보여서 기분 좋은 변화가 있어요. 새 잎 색을 다시 살펴봐 주세요.`;
      }

      if (photoShowsGrowth) {
        return `최근 사진 기록에 ${latestPhotoSummary}라고 남아 있어요. 자라는 모습이 보여서 기분이 좋아요. 다음 사진과도 비교해 봐요.`;
      }

      if (waterDoneToday) {
        return "기분이 좋아요. 오늘 물을 마셔서 잎을 더 힘차게 펼칠 수 있을 것 같아요.";
      }

      if (soilLooksDry) {
        return `조금 목말라서 기분이 완전 좋지는 않아요. 흙이 말랐다고 기록됐어요. ${soilCareAction}`;
      }

      if (leafNeedsCare) {
        return `조금 걱정돼요. 최근 잎 기록에 ${latestLeafSummary}라고 남아 있어요. ${leafCareAction}`;
      }

      if (waterNeedsCare) {
        return "조금 목말라요. 오늘 물을 마시면 기분이 더 좋아질 것 같아요.";
      }

      if (daysSinceLastRecord >= 3) {
        return "잘 모르겠어요. 요즘 관찰 기록이 없어서 잎과 흙을 한번 살펴봐 주면 내 기분을 더 잘 알 수 있어요.";
      }

      return "오늘은 꽤 괜찮아요. 그래도 잎 색과 흙 느낌을 살짝 확인해 주면 더 안심돼요.";
    }

    if (asksAboutPhoto) {
      if (latestPhotoAnalysis?.isPlantPhoto === false) {
        return "최근 사진은 식물 사진으로 확인하기 어려웠어요. 식물 전체와 잎, 흙이 보이게 다시 찍어 주세요.";
      }

      if (latestPhotoAnalysis) {
        return `최근 사진 분석에서는 ${latestPhotoVisibleText}라고 보였어요. ${latestPhotoActionText}`;
      }

      if (latestPhotoRecord) {
        return `최근 사진 기록은 ${latestPhotoSummary}였어요. 선생님이 AI 사진 확인을 누르면 사진에서 보이는 점도 함께 참고할 수 있어요.`;
      }

      return "아직 사진 기록이 없어요. 식물 전체와 잎, 흙이 보이게 사진을 남기면 더 잘 대답할 수 있어요.";
    }

    if (asksAboutPain) {
      if (asksAboutHelpingPain) {
        if (leafNeedsCare) {
          return `먼저 잎을 부드럽게 살펴봐 주세요. 최근 잎 기록에 ${latestLeafSummary}라고 남아 있어요. 뜨거운 자리라면 밝지만 덜 뜨거운 곳으로 옮기고, 계속 걱정되면 사진을 남겨 선생님께 알려 주세요.`;
        }

        if (soilLooksDry || waterNeedsCare) {
          return `먼저 흙을 손가락으로 살짝 만져 봐 주세요. 말랐다면 물을 조금 주고, 이미 젖어 있으면 더 주지 않아요. 잎이 계속 축 처지면 사진을 남겨 선생님께 알려 주세요.`;
        }

        return "먼저 잎 색, 줄기 힘, 흙 느낌을 차례로 살펴봐 주세요. 물이 너무 많거나 부족하지 않은지 보고, 걱정되는 모습은 사진으로 남겨 선생님께 알려 주세요.";
      }

      if (latestPhotoAnalysisAttention) {
        return `조금 걱정되는 모습이 있어요. 최근 사진에서는 ${latestPhotoVisibleText}라고 보였어요. ${latestPhotoAnalysisAttention.action}`;
      }

      if (leafNeedsCare) {
        return `아픈지 단정할 수는 없지만 최근 잎 기록에 ${latestLeafSummary}라고 남아 있어요. ${leafCareAction}`;
      }

      if (soilLooksDry || waterNeedsCare) {
        return `아픈지는 모르지만 조금 목마를 수 있어요. ${soilCareAction}`;
      }

      if (latestPhotoAnalysis?.visibleDetails) {
        return `아픈 모습으로 단정하긴 어려워요. 최근 사진에서는 ${latestPhotoVisibleText}라고 보였어요. 오늘 잎과 흙도 같이 확인해 주세요.`;
      }

      return "아픈지는 바로 알기 어려워요. 잎이 축 처졌는지, 흙이 말랐는지, 색이 달라졌는지 함께 살펴봐 주세요.";
    }

    if (asksAboutDance) {
      return "나는 뿌리가 있어서 춤추러 걸어가진 못해요. 대신 바람이 불면 잎이 살짝 움직일 수 있어요. 오늘 잎이 움직이는지 봐 주세요.";
    }

    if (asksAboutMovement) {
      return "나는 사람처럼 걸어 다니지는 못해요. 그래도 잎은 햇빛 쪽으로 조금씩 향하고, 줄기도 천천히 자라요. 며칠 뒤 사진과 비교해 봐요.";
    }

    if (asksAboutSchool) {
      return "나는 화분에서 교실을 지켜보는 식물이에요. 친구들이 관찰해 주면 오늘 하루가 더 특별해져요.";
    }

    if (asksAboutSleep) {
      if (compactQuestion.includes("꿈")) {
        return "나는 사람처럼 꿈을 꾸지는 않아요. 밤에는 조용히 쉬면서 물과 빛을 만난 하루를 지나 보내요. 내일 잎이 달라졌는지 봐 주세요.";
      }

      if (compactQuestion.includes("밤")) {
        return "밤에는 눈에 잘 보이지 않아도 조용히 쉬고 있어요. 너무 춥지 않은지, 아침에 잎이 싱싱한지 살펴봐 주세요.";
      }

      return "나는 눈을 감고 자지는 않지만 밤에는 조용히 쉬어요. 내일 잎이 더 싱싱해졌는지 봐 주세요.";
    }

    if (asksAboutIdentity) {
      return "나는 신기해 보일 수 있지만 교실에서 자라는 식물이에요. 햇빛과 물로 자라는 모습이 조금 마법 같죠.";
    }

    if (asksAboutName) {
      return `나는 ${plantDisplayName}, ${plantDisplayType}예요. 오늘은 내 잎과 흙이 어떤지 살펴봐 주세요.`;
    }

    if (asksAboutSmell) {
      if (teacherInfo?.smellInfo) {
        return `${teacherInfo.smellInfo} 잎이나 꽃을 비비거나 먹지는 말고, 선생님과 함께 살짝 맡아 봐요.`;
      }

      if (teacherInfo?.summary.includes("향") || teacherInfo?.observationPoints.includes("향")) {
        return `${plantDisplayType}는 향도 관찰해 볼 수 있어요. 잎이나 꽃을 비비거나 먹지는 말고, 선생님과 함께 살짝 맡아 봐요.`;
      }

      return "향이 나는 식물도 있고 거의 나지 않는 식물도 있어요. 가까이 문지르거나 먹지는 말고, 선생님과 함께 조심히 맡아 봐요.";
    }

    if (asksAboutPlace) {
      if (teacherInfo?.lightInfo) {
        return `${teacherInfo.lightInfo} 화분을 옮긴 뒤에는 잎이 뜨거운지, 흙이 너무 빨리 마르는지도 살펴봐 주세요.`;
      }

      return "나는 밝지만 너무 뜨겁지 않은 자리를 좋아해요. 잎이 뜨거워지지 않는지 보고, 흙이 너무 마르지 않게 살펴봐 주세요.";
    }

    if (asksAboutSeason) {
      if (compactQuestion.includes("추워")) {
        if (leafNeedsCare) {
          return `조금 힘들어 보일 수 있어요. 최근 잎 기록에 ${latestLeafSummary}라고 남아 있어요. 찬바람을 맞는지 살펴봐 주세요.`;
        }

        if (daysSinceLastRecord < 3) {
          return "지금 바로 춥다고 말하긴 어려워요. 잎이 축 처졌거나 찬바람을 맞고 있는지 살펴봐 주세요.";
        }

        return "요즘 기록이 적어서 추운지 알기 어려워요. 잎이 차갑거나 축 처졌는지 먼저 살펴봐 주세요.";
      }

      if (compactQuestion.includes("겨울")) {
        return "따뜻한 실내라면 겨울에도 지낼 수 있어요. 찬바람을 바로 맞지 않는지 잎을 살펴봐 주세요.";
      }

      if (compactQuestion.includes("여름") || compactQuestion.includes("더워")) {
        if (compactQuestion.includes("더워")) {
          return "너무 뜨거우면 힘들 수 있어요. 잎이 뜨겁거나 흙이 빨리 마르는지 살펴봐 주세요.";
        }

        return "여름에는 너무 뜨거운 자리를 조심해야 해요. 잎이 뜨겁지 않은지 살펴봐 주세요.";
      }

      if (teacherInfo?.environmentInfo) {
        return `계절이 바뀌어도 환경이 맞으면 지낼 수 있어요. ${teacherInfo.environmentInfo} 잎 색, 흙 마름, 새 잎이 달라지는지 관찰해 봐요.`;
      }

      if (teacherInfo?.lightInfo || teacherInfo?.careInfo) {
        return `계절이 바뀌면 자리와 물 주기를 더 조심히 봐야 해요. ${teacherInfo.lightInfo ?? ""} ${teacherInfo.careInfo ?? ""} 잎이 뜨겁거나 차갑지 않은지도 살펴봐 주세요.`;
      }

      return "겨울에도 살 수 있는지는 식물 종류와 실내 온도에 따라 달라요. 추운 바람을 바로 맞지 않는지, 잎이 축 처지지 않는지 살펴봐 주세요.";
    }

    if (asksAboutLifecycle) {
      if (
        compactQuestion.includes("죽") ||
        compactQuestion.includes("시들")
      ) {
        return "식물도 환경이 맞지 않으면 시들 수 있어요. 그래서 잎 색, 줄기 힘, 흙 상태를 매일 살펴보면 좋아요.";
      }

      if (teacherInfo?.lifecycleInfo) {
        return `${teacherInfo.lifecycleInfo} 시드는 시기를 맞히기보다 잎 색, 줄기 힘, 새 잎 변화를 기록하면 더 잘 알 수 있어요.`;
      }

      return "식물도 계속 똑같이 살지는 않아요. 얼마나 오래 사는지는 종류와 환경에 따라 달라요. 잎이 노랗게 변하거나 줄기가 힘이 없어지는지 천천히 관찰해 주세요.";
    }

    if (asksAboutAge) {
      if (teacherInfo?.growthInfo) {
        return `${teacherInfo.growthInfo} 정확한 나이보다 오늘 키와 잎 수를 기록하면 자란 모습을 더 잘 알 수 있어요.`;
      }

      return "내 나이는 정확히 말하기 어려워요. 대신 오늘 키와 잎 수를 기록하면, 며칠 뒤 얼마나 자랐는지 알 수 있어요.";
    }

    if (asksAboutPlantFamily) {
      if (
        compactQuestion.includes("결혼") ||
        compactQuestion.includes("남편") ||
        compactQuestion.includes("아내") ||
        compactQuestion.includes("짝")
      ) {
        return "나는 사람처럼 결혼하지는 않아요. 대신 식물은 꽃가루가 옮겨지거나 씨앗이 생기면서 새 식물이 자랄 수 있어요. 꽃이나 씨앗이 보이는지 살펴볼까요?";
      }

      if (compactQuestion.includes("낳") || compactQuestion.includes("아기")) {
        return "나는 사람처럼 아기를 낳지는 않아요. 식물은 씨앗이 자라거나, 어떤 식물은 줄기나 잎에서 새 식물로 자랄 수 있어요. 오늘 새 잎이 있는지 찾아볼까요?";
      }

      return "나는 사람처럼 엄마 아빠가 보이지는 않지만, 씨앗이나 작은 식물에서 자라났어요. 오늘 내 새 잎과 줄기를 보면 자라는 흔적을 찾을 수 있어요.";
    }

    const isPlantChatScope =
      asksAboutWater ||
      asksAboutLeaf ||
      asksAboutLeafProblem ||
      asksAboutSoil ||
      asksAboutPhoto ||
      asksAboutSun ||
      asksAboutMood ||
      asksAboutPain ||
      asksAboutDislike ||
      asksAboutPlantPreference ||
      asksAboutLike ||
      asksAboutHungry ||
      asksAboutDance ||
      asksAboutMovement ||
      asksAboutSchool ||
      asksAboutChildlikeQuestion ||
      asksAboutSleep ||
      asksAboutTalking ||
      asksAboutIdentity ||
      asksAboutName ||
      saysGreeting ||
      saysAffection ||
      asksAboutAge ||
      asksAboutSpeciesInfo ||
      includesAny(compactQuestion, [
        "식물",
        "잎",
        "줄기",
        "뿌리",
        "흙",
        "물",
        "햇빛",
        "화분",
        "자라",
        "시들",
        "꽃",
        "열매",
        "씨앗",
      ]);

    if (!isPlantChatScope) {
      return "나는 그 이야기는 잘 모르지만, 식물로서 대답해 볼게요. 오늘 내 잎, 흙, 물, 햇빛 중 하나를 같이 살펴봐 주세요.";
    }

    if (daysSinceLastRecord >= 3) {
      return "요즘 관찰 기록이 없어서 정확히 말하기 어려워요. 잎, 흙, 사진 중 하나를 먼저 기록해 주면 더 잘 대답할 수 있어요.";
    }

    const curiousAnswers = [
      teacherInfo?.childAnswerHints
        ? `${teacherInfo.childAnswerHints} 오늘은 잎, 줄기, 흙 중 하나를 골라 관찰해 봐요.`
        : "재미있는 질문이에요. 나는 식물이라 그건 정확히 말하기 어렵지만, 오늘 잎과 흙을 보면 내 상태는 알 수 있어요.",
      "그 질문은 조금 어렵네요. 대신 잎 색, 흙 느낌, 키가 달라졌는지 살펴보면 오늘의 힌트를 찾을 수 있어요.",
      "나는 그건 잘 모르지만, 지금 내 모습을 관찰하면 새로운 발견을 할 수 있어요. 잎이나 흙부터 살펴볼까요?",
    ];

    return curiousAnswers[compactQuestion.length % curiousAnswers.length];
  };

  const handleSendMessage = async (rawQuestion = messageInputRef.current?.value ?? message) => {
    const question = rawQuestion.trim();

    if (!question) return;

    let answer = "잠깐 생각해볼게요. 오늘 내 잎, 흙, 물, 햇빛 중 하나를 같이 살펴봐 주세요.";
    let shouldAskAi = true;
    const compactQuestionForSend = question.replace(/\s/g, "").toLowerCase();
    const asksDirectHelpForPain =
      ["아파", "아프", "아픈", "힘들"].some((keyword) =>
        compactQuestionForSend.includes(keyword)
      ) &&
      ["도와", "도움", "어떻게", "어찌"].some((keyword) =>
        compactQuestionForSend.includes(keyword)
      );

    try {
      if (asksDirectHelpForPain) {
        answer =
          "먼저 잎 색, 줄기 힘, 흙 느낌을 차례로 살펴봐 주세요. 물이 너무 많거나 부족하지 않은지 보고, 걱정되는 모습은 사진으로 남겨 선생님께 알려 주세요.";
        shouldAskAi = false;
      } else {
        answer = createPlantAnswer(question);
        shouldAskAi = shouldUseAiChatFallback(question);
      }
    } catch (error) {
      console.error("답변 생성 실패:", error);
      shouldAskAi = true;
    }

    const messageId = createRecordId();

    setChatMessages((prev) =>
      trimChatMessages([
        ...prev,
        {
          id: messageId,
          childName: activeChildName,
          question,
          answer: shouldAskAi ? "잠깐 생각해볼게요." : answer,
        },
      ])
    );

    setMessage("");
    if (messageInputRef.current) {
      messageInputRef.current.value = "";
    }

    if (!shouldAskAi) return;

    const aiCacheKey = createAiChatCacheKey(
      plantDisplayName,
      plantDisplayType,
      question
    );
    const cachedAiAnswer = aiChatCache[aiCacheKey];

    if (cachedAiAnswer) {
      setChatMessages((prev) =>
        trimChatMessages(
          prev.map((chatMessage) =>
            chatMessage.id === messageId
              ? {
                  ...chatMessage,
                  answer: cachedAiAnswer,
                }
              : chatMessage
          )
        )
      );
      return;
    }

    const currentAiUsage = normalizeAiChatUsage(aiChatUsage, todayKey);

    if (currentAiUsage.count >= DAILY_AI_CHAT_LIMIT) {
      const limitAnswer = getAiLimitAnswer();

      setChatMessages((prev) =>
        trimChatMessages(
          prev.map((chatMessage) =>
            chatMessage.id === messageId
              ? {
                  ...chatMessage,
                  answer: limitAnswer,
                }
              : chatMessage
          )
        )
      );
      return;
    }

    setAiChatUsage({
      dateKey: todayKey,
      count: currentAiUsage.count + 1,
    });

    try {
      const aiAnswer = await loadChatAnswerFromServer({
        question,
        fallbackAnswer: answer,
        plantName: plantDisplayName,
        plantType: plantDisplayType,
        teacherInfo,
        careState,
        recentRecords: currentPlantRecords.slice(-6),
        latestPhotoAnalysis,
        openAiApiKey,
      });

      setChatMessages((prev) =>
        trimChatMessages(
          prev.map((chatMessage) =>
            chatMessage.id === messageId
              ? {
                  ...chatMessage,
                  answer: aiAnswer,
                }
              : chatMessage
          )
        )
      );
      setAiChatCache((prev) =>
        trimAiChatCache({
          ...prev,
          [aiCacheKey]: aiAnswer,
        })
      );
    } catch {
      setChatMessages((prev) =>
        trimChatMessages(
          prev.map((chatMessage) =>
            chatMessage.id === messageId
              ? {
                  ...chatMessage,
                  answer,
                }
              : chatMessage
          )
        )
      );
      setSpeechError(
        "AI 답변이 잠시 어려워서 앱 안의 안전 답변으로 대답했어요."
      );
    }
  };

  const stopSpeaking = () => {
    activeAudioIdRef.current = "";

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setReadingMessageId("");
    setLoadingAudioId("");
  };

  const preloadSpeechText = async (text: string, messageId: string) => {
    const speechText = createShortSpeechText(text);
    const audioCacheKey = createAudioCacheKey(messageId, speechText);

    if (
      audioUrlCacheRef.current[audioCacheKey] ||
      audioPreloadRef.current.has(audioCacheKey)
    ) {
      return;
    }

    audioPreloadRef.current.add(audioCacheKey);

    try {
      const audioUrl = await requestTtsObjectUrl(speechText, openAiApiKey);
      audioUrlCacheRef.current[audioCacheKey] = audioUrl;
    } catch {
      // Preload is best-effort; the button can still fall back later.
    } finally {
      audioPreloadRef.current.delete(audioCacheKey);
    }
  };

  const speakWithBrowserVoice = (text: string, messageId: string) => {
    if (
      typeof window === "undefined" ||
      !window.speechSynthesis ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setSpeechError("이 브라우저에서는 읽어주기를 사용할 수 없어요.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const friendlyVoice = chooseFriendlyKoreanVoice(availableVoices);

    utterance.lang = "ko-KR";
    utterance.rate = 0.78;   // 천천히 부드럽게
    utterance.pitch = 1.55;  // 귀엽고 부드러운 톤
    utterance.volume = 1;

    if (friendlyVoice) {
      utterance.voice = friendlyVoice;
    }

    utterance.onstart = () => {
      setSpeechError("");
      setReadingMessageId(messageId);
    };

    utterance.onend = () => {
      setReadingMessageId((currentId) =>
        currentId === messageId ? "" : currentId
      );
    };

    utterance.onerror = () => {
      setReadingMessageId("");
      setSpeechError("읽어주기에 실패했어요. 다시 눌러 주세요.");
    };

    window.speechSynthesis.speak(utterance);
  };

  const speakText = async (text: string, messageId: string) => {
    const speechText = createShortSpeechText(text);
    const audioCacheKey = createAudioCacheKey(messageId, speechText);

    activeAudioIdRef.current = messageId;
    setSpeechError("");
    setLoadingAudioId(messageId);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      let audioUrl = audioUrlCacheRef.current[audioCacheKey];

      if (!audioUrl) {
        audioUrl = await requestTtsObjectUrl(speechText, openAiApiKey);
        audioUrlCacheRef.current[audioCacheKey] = audioUrl;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.preload = "auto";
      audio.playbackRate = 1.0; // 속도 그대로 재생

      audio.onplay = () => {
        if (activeAudioIdRef.current === messageId) {
          setReadingMessageId(messageId);
        }
      };

      audio.onended = () => {
        if (activeAudioIdRef.current !== messageId) return;

        activeAudioIdRef.current = "";
        setReadingMessageId((currentId) =>
          currentId === messageId ? "" : currentId
        );
      };

      audio.onerror = () => {
        if (activeAudioIdRef.current !== messageId) return;
        activeAudioIdRef.current = "";
        setReadingMessageId("");
        speakWithBrowserVoice(speechText, messageId);
      };

      audio.load();
      await audio.play();
    } catch {
      activeAudioIdRef.current = "";
      speakWithBrowserVoice(speechText, messageId);
    } finally {
      setLoadingAudioId("");
    }
  };

  const startVoiceQuestion = () => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      setSpeechError("이 브라우저에서는 말로 질문하기가 지원되지 않아요.");
      return;
    }

    recognitionRef.current?.stop();
    setSpeechError("");

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError("듣고 있어요. 아이가 천천히 한 문장으로 말해 주세요.");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (transcript) {
        setMessage(transcript);
        setSpeechError(`이렇게 들었어요: "${transcript}" 맞으면 보내기를 눌러 주세요.`);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setSpeechError("마이크 권한을 허용해야 말로 질문할 수 있어요.");
      } else if (event.error === "no-speech") {
        setSpeechError("소리가 잘 들리지 않았어요. 다시 말해 주세요.");
      } else {
        setSpeechError("말을 잘 알아듣지 못했어요. 다시 시도해 주세요.");
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setSpeechError("마이크를 시작하지 못했어요. 다시 눌러 주세요.");
      setIsListening(false);
    }
  };

  const stopVoiceQuestion = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const handlePhotoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 선택할 수 있어요.");
      return;
    }

    try {
      const resizedImage = await resizeImageFile(file);
      setPhotoImageData(resizedImage);
      playChoiceSound();
    } catch {
      alert("사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.");
    } finally {
      event.target.value = "";
    }
  };

  const removePhotoImage = () => {
    setPhotoImageData("");
  };

  const saveLeafRecord = () => {
    if (!leafColor || !leafShape) {
      setObservationNotice("그림 카드를 두 개 골라 주세요.");
      return;
    }

    const nextRecord: ObservationRecord = {
      id: createRecordId(),
      childName: activeChildName,
      plantName: plantDisplayName,
      plantType: plantDisplayType,
      type: "leaf",
      title: "잎 관찰",
      date: todayLabel,
      dateKey: todayKey,
      firstLabel: "잎 색깔",
      firstValue: leafColor,
      firstIcon: leafColorIcon,
      secondLabel: "잎 모양",
      secondValue: leafShape,
      secondIcon: leafShapeIcon,
      memo: leafMemo.trim() || "그림으로 기록했어요.",
    };

    setRecords((prev) => [nextRecord, ...prev]);
    setLeafColor("");
    setLeafColorIcon("");
    setLeafShape("");
    setLeafShapeIcon("");
    setLeafMemo("");

    setObservationNotice("");
    setRecordSaveNotice("잎 기록이 저장됐어요.");
    setScreen("record");
  };

  const saveSoilRecord = () => {
    if (!soilState || !soilColor) {
      setObservationNotice("그림 카드를 두 개 골라 주세요.");
      return;
    }

    const nextRecord: ObservationRecord = {
      id: createRecordId(),
      childName: activeChildName,
      plantName: plantDisplayName,
      plantType: plantDisplayType,
      type: "soil",
      title: soilRecordTitle,
      date: todayLabel,
      dateKey: todayKey,
      firstLabel: soilFirstLabel,
      firstValue: soilState,
      firstIcon: soilStateIcon,
      secondLabel: soilSecondLabel,
      secondValue: soilColor,
      secondIcon: soilColorIcon,
      memo: soilMemo.trim() || "그림으로 기록했어요.",
    };

    setRecords((prev) => [nextRecord, ...prev]);
    setSoilState("");
    setSoilStateIcon("");
    setSoilColor("");
    setSoilColorIcon("");
    setSoilMemo("");

    setObservationNotice("");
    setRecordSaveNotice(
      usesSproutBaseCare
        ? "바닥/물 기록이 저장됐어요."
        : "흙 기록이 저장됐어요."
    );
    setScreen("record");
  };

  const savePhotoRecord = () => {
    if (!photoChange || !photoFeeling) {
      setObservationNotice("변화와 느낌 그림을 하나씩 골라 주세요.");
      return;
    }

    const nextRecord: ObservationRecord = {
      id: createRecordId(),
      childName: activeChildName,
      plantName: plantDisplayName,
      plantType: plantDisplayType,
      type: "photo",
      title: "사진 기록",
      date: todayLabel,
      dateKey: todayKey,
      firstLabel: "오늘의 변화",
      firstValue: photoChange,
      firstIcon: photoChangeIcon,
      secondLabel: "오늘의 느낌",
      secondValue: photoFeeling,
      secondIcon: photoFeelingIcon,
      memo: photoMemo.trim() || "그림으로 기록했어요.",
      imageData: photoImageData || undefined,
    };

    setRecords((prev) => [nextRecord, ...prev]);
    setPhotoChange("");
    setPhotoChangeIcon("");
    setPhotoFeeling("");
    setPhotoFeelingIcon("");
    setPhotoMemo("");
    setPhotoImageData("");

    setObservationNotice("");
    setRecordSaveNotice("사진 기록이 저장됐어요.");
    setScreen("record");
  };

  const deleteRecord = (id: string) => {
    const confirmed = window.confirm("이 기록을 삭제할까요?");
    if (!confirmed) return;

    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const analyzePhotoRecord = async (record: ObservationRecord) => {
    if (!record.imageData) {
      setPhotoAnalysisNotice("사진이 있는 기록만 AI로 살펴볼 수 있어요.");
      return;
    }

    setAnalyzingPhotoRecordId(record.id);
    setPhotoAnalysisNotice(
      record.photoAnalysis
        ? "AI가 사진을 다시 살펴보는 중이에요. 이때만 비용이 사용돼요."
        : "AI가 사진을 살펴보는 중이에요. 이때만 비용이 사용돼요."
    );

    try {
      const analysis = await loadPhotoAnalysisFromServer({
        plantName: record.plantName || plantDisplayName,
        plantType: record.plantType || plantDisplayType,
        imageData: record.imageData,
        openAiApiKey,
      });

      setRecords((prev) =>
        prev.map((item) =>
          item.id === record.id ? { ...item, photoAnalysis: analysis } : item
        )
      );
      setPhotoAnalysisNotice("사진 분석 결과가 기록에 저장됐어요.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "사진 분석에 실패했어요.";

      setPhotoAnalysisNotice(
        `${message} 서버와 API 키를 확인하고, 필요할 때 다시 눌러 주세요.`
      );
    } finally {
      setAnalyzingPhotoRecordId("");
    }
  };

  const installApp = async () => {
    if (isAppInstalled) {
      alert("이미 앱처럼 설치되어 있어요.");
      return;
    }

    if (!installPrompt) {
      alert(
        "설치 준비가 아직 안 됐어요. 페이지를 새로고침한 뒤 주소창 오른쪽의 설치 아이콘이나 브라우저 메뉴의 '앱 설치'를 눌러 주세요."
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsAppInstalled(true);
    }

    setInstallPrompt(null);
  };

  const renderBottomNav = () => {
    return (
      <nav style={styles.bottomNav}>
        {navItems.map((item) => {
          const isActive = screen === item.screen;

          return (
            <button
              key={item.screen}
              type="button"
              style={isActive ? styles.navItemActive : styles.navItem}
              onClick={() => setScreen(item.screen)}
            >
              <img src={item.icon} alt={item.label} style={styles.navLogo} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  };

  const renderOpenAiKeyPanel = () => {
    if (!showOpenAiKeyPanel) return null;

    return (
      <div style={styles.apiKeyModalBackdrop}>
        <div style={styles.apiKeyModalCard}>
          <div style={styles.apiKeyModalHeader}>
            <div>
              <h2 style={styles.apiKeyModalTitle}>OpenAI API 키</h2>
              <p style={styles.apiKeyModalDesc}>
                오픈AI 사용 요금은 입력한 키 소유자에게 청구됩니다.
              </p>
            </div>
            <button
              type="button"
              style={styles.apiKeyModalCloseButton}
              onClick={() => setShowOpenAiKeyPanel(false)}
            >
              ×
            </button>
          </div>

          <input
            type="password"
            value={openAiApiKey}
            onChange={(event) => setOpenAiApiKey(event.target.value)}
            placeholder="sk-..."
            style={styles.apiKeyInput}
          />

          <p style={styles.apiKeyErrorText}>
            {openAiApiKeyError ||
              (openAiApiKey.trim()
                ? "키가 저장되었습니다. 다시 입력하면 교체됩니다."
                : "키를 입력하면 브라우저에 안전하게 저장됩니다.")}
          </p>

          <div style={styles.apiKeyActions}>
            <button
              type="button"
              style={styles.saveButton}
              onClick={() => {
                if (!openAiApiKey.trim()) {
                  setOpenAiApiKeyError("API 키를 입력해 주세요.");
                  return;
                }
                setShowOpenAiKeyPanel(false);
              }}
            >
              닫기
            </button>
            {openAiApiKey.trim() && (
              <button
                type="button"
                style={styles.apiKeyRemoveButton}
                onClick={() => {
                  setOpenAiApiKey("");
                  setOpenAiApiKeyError("");
                  setShowOpenAiKeyPanel(false);
                }}
              >
                삭제
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTopBar = (title: string, desc: string) => {
    return (
      <>
        <header style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <img src={mainImagePath} alt="식물" style={styles.topBarIcon} />

            <div>
              <h1 style={styles.topBarTitle}>{title}</h1>
              <p style={styles.topBarDesc}>{desc}</p>
            </div>
          </div>

          <div style={styles.topBarActions}>
            <label style={styles.childNameBox}>
              <span>아이</span>
              <input
                value={childSearchText}
                onChange={(event) => setChildSearchText(event.target.value)}
                onFocus={() => setChildSearchText("")}
                placeholder={currentChildName || "검색"}
                style={styles.childNameSelect}
              />

              {childSearchText && (
                <div style={styles.childSearchPopover}>
                  {filteredChildNames.length > 0 ? (
                    filteredChildNames.map((childName) => (
                      <button
                        key={childName}
                        type="button"
                        style={styles.childSearchOption}
                        onClick={() => selectChildName(childName)}
                      >
                        {childName}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      style={styles.childSearchOption}
                      onClick={() => {
                        const trimmedSearchText = childSearchText.trim();
                        if (!trimmedSearchText) return;
                        const nextRoster = getUniqueChildNames([
                          ...knownChildNames,
                          trimmedSearchText,
                        ]);
                        setChildRoster(nextRoster);
                        selectChildName(trimmedSearchText);
                      }}
                    >
                      “{childSearchText}” 추가
                    </button>
                  )}
                </div>
              )}
            </label>

            <button
              type="button"
              style={styles.childAddButton}
              onClick={() => setScreen("start")}
            >
              다른 아이
            </button>

            <button
              type="button"
              style={styles.apiKeyButton}
              onClick={() => setShowOpenAiKeyPanel(true)}
            >
              OpenAI 키
            </button>

            <button
              type="button"
              style={styles.installButton}
              onClick={installApp}
            >
              <img src="/icons/home.png" alt="앱 설치" style={styles.settingsIcon} />
              <span>{isAppInstalled ? "설치됨" : "앱 설치"}</span>
            </button>

            {/* 답변 테스트 버튼 — 내부 개발용, 배포 환경에서는 숨김 */}
          </div>
        </header>

        {renderOpenAiKeyPanel()}
      </>
    );
  };

  const renderChoiceCard = (
    option: ChoiceOption,
    selectedValue: string,
    onClick: () => void
  ) => {
    const isSelected = selectedValue === option.label;

    return (
      <button
        key={option.label}
        type="button"
        style={{
          ...styles.choiceCard,
          background: option.color,
          border: isSelected ? "4px solid #4F8A3C" : "2px solid #D8CFB8",
        }}
        onClick={() => {
          playChoiceSound();
          setObservationNotice("");
          onClick();
        }}
      >
        <img src={option.icon} alt={option.label} style={styles.choiceIcon} />
        <span style={styles.choiceLabel}>{option.label}</span>
      </button>
    );
  };

  const renderRecordCard = (record: ObservationRecord) => {
    return (
      <article key={record.id} style={styles.recordCard}>
        {record.imageData && (
          <img
            src={record.imageData}
            alt="식물 기록 사진"
            style={styles.recordPhoto}
          />
        )}

        <div style={styles.recordCardHeader}>
          <div>
            <p style={styles.recordDate}>{record.date}</p>
            {record.childName && (
              <p style={styles.recordChildName}>{record.childName}</p>
            )}
            <h3 style={styles.recordTitle}>{record.title}</h3>
          </div>

          <button
            type="button"
            style={styles.recordDeleteButton}
            onClick={() => deleteRecord(record.id)}
          >
            삭제
          </button>
        </div>

        <div style={styles.recordChoiceRow}>
          <div style={styles.recordChoiceBox}>
            <img
              src={record.firstIcon}
              alt={record.firstValue}
              style={styles.recordChoiceIcon}
            />
            <p style={styles.recordChoiceLabel}>{record.firstLabel}</p>
            <strong style={styles.recordChoiceText}>{record.firstValue}</strong>
          </div>

          <div style={styles.recordChoiceBox}>
            <img
              src={record.secondIcon}
              alt={record.secondValue}
              style={styles.recordChoiceIcon}
            />
            <p style={styles.recordChoiceLabel}>{record.secondLabel}</p>
            <strong style={styles.recordChoiceText}>{record.secondValue}</strong>
          </div>
        </div>

        <p style={styles.recordMemo}>{record.memo}</p>

        {record.type === "photo" && record.imageData && (
          <div style={styles.photoChildSummaryBox}>
            <span style={styles.photoChildSummaryLabel}>아이용 사진 기록</span>
            <strong>{getPhotoAnalysisChildText(record.photoAnalysis)}</strong>
            <button
              type="button"
              style={styles.photoChildReadButton}
              disabled={Boolean(loadingAudioId)}
              onClick={() =>
                readingMessageId === `photo-child-${record.id}`
                  ? stopSpeaking()
                  : speakText(
                      getPhotoAnalysisChildText(record.photoAnalysis),
                      `photo-child-${record.id}`
                    )
              }
            >
              {readingMessageId === `photo-child-${record.id}`
                ? "멈추기"
                : loadingAudioId === `photo-child-${record.id}`
                  ? "준비 중"
                  : "읽어주기"}
            </button>
          </div>
        )}

        {record.type === "photo" && record.imageData && (
          <div style={styles.photoAiBox}>
            <div>
              <p style={styles.photoAiLabel}>교사용 AI 사진 확인</p>
              <p style={styles.photoAiText}>
                선생님이 누를 때만 분석돼요. 결과는 주의 기록에도 연결돼요.
              </p>
            </div>

            {record.photoAnalysis ? (
              <>
                <div style={styles.photoAnalysisResult}>
                  <div
                    style={
                      record.photoAnalysis.isPlantPhoto === false
                        ? styles.photoAnalysisBadgeWarning
                        : styles.photoAnalysisBadge
                    }
                  >
                    {record.photoAnalysis.isPlantPhoto === false
                      ? "식물 사진 아님"
                      : "식물 사진 확인"}
                  </div>
                  <div style={styles.photoAnalysisLine}>
                    <span>사진에서 보이는 것</span>
                    <strong>
                      {getSafePhotoAnalysisText(
                        record.photoAnalysis.visibleDetails ||
                          record.photoAnalysis.summary,
                        "사진에서 보이는 점은 선생님과 다시 확인해요."
                      )}
                    </strong>
                  </div>
                  <div style={styles.photoAnalysisLine}>
                    <span>확인 어려운 것</span>
                    <strong>
                      {getSafePhotoAnalysisText(
                        record.photoAnalysis.uncertainDetails ||
                          `${record.photoAnalysis.leafHint} ${record.photoAnalysis.soilHint}`,
                        "사진만으로 확인하기 어려운 부분이 있어요."
                      )}
                    </strong>
                  </div>
                  <div style={styles.photoAnalysisAction}>
                    <span>다음 행동</span>
                    {getSafePhotoAnalysisText(
                      record.photoAnalysis.action,
                      "같은 자리에서 다시 사진을 남기고 잎과 흙을 확인해요."
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  style={styles.photoAiButton}
                  onClick={() => analyzePhotoRecord(record)}
                  disabled={Boolean(analyzingPhotoRecordId)}
                >
                  {analyzingPhotoRecordId === record.id
                    ? "다시 보는 중"
                    : "다시 분석하기"}
                </button>
              </>
            ) : (
              <button
                type="button"
                style={styles.photoAiButton}
                onClick={() => analyzePhotoRecord(record)}
                disabled={Boolean(analyzingPhotoRecordId)}
              >
                {analyzingPhotoRecordId === record.id
                  ? "살펴보는 중"
                  : "AI로 사진 살펴보기"}
              </button>
            )}
          </div>
        )}
      </article>
    );
  };

  const renderRecordGroup = (
    title: string,
    icon: string,
    groupRecords: ObservationRecord[],
    emptyText: string
  ) => {
    return (
      <section style={styles.recordGroupBox}>
        <div style={styles.recordGroupHeader}>
          <div style={styles.recordGroupTitleBox}>
            <img src={icon} alt={title} style={styles.recordGroupIcon} />
            <h3 style={styles.recordGroupTitle}>{title}</h3>
          </div>

          <span style={styles.recordGroupCount}>{groupRecords.length}개</span>
        </div>

        {groupRecords.length === 0 ? (
          <div style={styles.recordGroupEmpty}>{emptyText}</div>
        ) : (
          <div style={styles.recordGrid}>
            {groupRecords.map((record) => renderRecordCard(record))}
          </div>
        )}
      </section>
    );
  };

  const renderMotionStyles = () => (
    <style>
      {`
        @keyframes plantTalkWaterCanTilt {
          0% { transform: rotate(0deg) translateY(0); }
          28% { transform: rotate(-18deg) translate(-8px, 2px); }
          70% { transform: rotate(-18deg) translate(-8px, 2px); }
          100% { transform: rotate(0deg) translateY(0); }
        }

        @keyframes plantTalkDropFall {
          0% { opacity: 0; transform: translateY(-34px) scale(0.8); }
          18% { opacity: 1; }
          78% { opacity: 1; transform: translateY(42px) scale(1); }
          100% { opacity: 0; transform: translateY(58px) scale(0.75); }
        }

        @keyframes plantTalkPlantBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          42% { transform: translateY(-7px) scale(1.04); }
          72% { transform: translateY(2px) scale(0.98); }
        }

        @keyframes plantTalkSunGlow {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(240, 190, 64, 0)); }
          45% { transform: scale(1.12); filter: drop-shadow(0 0 18px rgba(240, 190, 64, 0.75)); }
        }

        @keyframes plantTalkCardRise {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .plant-talk-water-active .plant-talk-water-can {
          animation: plantTalkWaterCanTilt 1.15s ease-in-out both;
        }

        .plant-talk-water-active .plant-talk-drop {
          animation: plantTalkDropFall 0.95s ease-in both;
        }

        .plant-talk-water-active .plant-talk-drop:nth-child(2) {
          animation-delay: 0.08s;
        }

        .plant-talk-water-active .plant-talk-drop:nth-child(3) {
          animation-delay: 0.22s;
        }

        .plant-talk-water-active .plant-talk-care-plant,
        .plant-talk-sun-active .plant-talk-care-plant {
          animation: plantTalkPlantBounce 1.05s ease-in-out both;
        }

        .plant-talk-sun-active .plant-talk-sun {
          animation: plantTalkSunGlow 1.25s ease-in-out both;
        }

        .plant-talk-test-card {
          animation: plantTalkCardRise 0.34s ease-out both;
        }
      `}
    </style>
  );

  const renderWaterPrompt = () => {
    if (!shouldShowWaterPrompt) return null;

    return (
      <div style={styles.waterPromptBackdrop}>
        <section style={styles.waterPromptCard}>
          <img
            src={mainImagePath}
            alt={plantDisplayName}
            style={styles.waterPromptPlant}
          />

          <div style={styles.waterPromptTextBox}>
            <p style={styles.attentionLabel}>{plantDisplayName}가 말해요</p>
            <h2 style={styles.waterPromptTitle}>목이 마른지 확인해 줄래?</h2>
            <p style={styles.waterPromptText}>
              {soilLooksDry
                ? "최근 흙이 말랐다고 기록됐어요. 흙을 살짝 만져 보고 말랐다면 물을 조금 주세요."
                : `${careState.waterIntervalDays}일 물 주기 기준이 되었어요. 먼저 흙을 만져 보고 말랐을 때만 물을 주세요.`}
            </p>

            <div style={styles.waterPromptActions}>
              <button
                type="button"
                style={styles.waterPromptPrimary}
                onClick={() => {
                  dismissWaterPrompt();
                  setScreen("soilRecord");
                }}
              >
                흙 확인하기
              </button>

              <button
                type="button"
                style={styles.waterPromptSecondary}
                onClick={() => {
                  dismissWaterPrompt();
                  increaseCount("waterCount");
                  setScreen("care");
                }}
              >
                물 줬어요
              </button>

              <button
                type="button"
                style={styles.waterPromptGhost}
                onClick={dismissWaterPrompt}
              >
                나중에 볼게요
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  };

  if (screen === "start") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          {renderMotionStyles()}

          <section style={styles.startPanel}>
            <div style={styles.startCompactHeader}>
              <img
                src={mainImagePath}
                alt="식물talk 대표 이미지"
                style={styles.startMainImage}
              />

              <div>
                <h1 style={styles.startTitle}>식물talk</h1>

                <p style={styles.startSubtitle}>
                  누가 오늘 식물을 관찰하나요?
                </p>
              </div>
            </div>

            {knownChildNames.length > 0 ? (
              <div style={styles.startChildGrid}>
                {knownChildNames.map((childName) => {
                  const participation = childParticipationRows.find(
                    (row) => row.childName === childName
                  );

                  return (
                    <div key={childName} style={{ position: "relative", width: "100%", height: "100%" }}>
                      <button
                        type="button"
                        style={
                          childName === currentChildName
                            ? { ...styles.startChildButtonActive, width: "100%", height: "100%" }
                            : { ...styles.startChildButton, width: "100%", height: "100%" }
                        }
                        onClick={() => {
                          selectChildName(childName);
                          setScreen("home");
                        }}
                      >
                        <strong style={styles.startChildName}>{childName}</strong>
                        <span style={styles.startChildMeta}>
                          기록 {participation?.recordCount ?? 0} · 질문{" "}
                          {participation?.questionCount ?? 0}
                        </span>
                        <span style={styles.childParticipationBarTrack}>
                          <span
                            style={{
                              ...styles.childParticipationBarFill,
                              width: `${Math.min(
                                100,
                                ((participation?.total ?? 0) / 5) * 100
                              )}%`,
                            }}
                          />
                        </span>
                      </button>
                      <button
                        type="button"
                        title={`${childName} 삭제`}
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          border: "none",
                          background: "rgba(0,0,0,0.15)",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: 900,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                          padding: 0,
                          zIndex: 2,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!window.confirm(`${childName} 아이를 삭제할까요?`)) return;
                          const nextRoster = knownChildNames.filter(n => n !== childName);
                          setChildRoster(nextRoster);
                          localStorage.setItem(CHILD_ROSTER_STORAGE_KEY, JSON.stringify(nextRoster));
                          if (currentChildName === childName) {
                            const next = nextRoster[0] ?? "";
                            setCurrentChildName(next);
                            localStorage.setItem(CHILD_STORAGE_KEY, next);
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={styles.startHelperText}>
                먼저 아이 이름을 한 번 추가해 주세요.
              </p>
            )}

            <div style={styles.startActionRow}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={addChildToRoster}
              >
                아이 추가
              </button>

              {currentChildName && (
                <button
                  type="button"
                  style={styles.secondaryStartButton}
                  onClick={() => setScreen("home")}
                >
                  이어서 시작
                </button>
              )}
            </div>
          </section>

          {renderWaterPrompt()}
        </div>
      </div>
    );
  }

  if (screen === "leafRecord") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("observe")}
              >
                ←
              </button>

              <img src="/icons/leaf.png" alt="잎 관찰" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>잎 관찰 기록</h1>
                <p style={styles.topBarDesc}>그림 카드를 눌러 잎 상태를 남겨요</p>
              </div>
            </header>

            <main style={styles.observationLayout}>
              <section style={styles.observationSideCard}>
                <img src="/icons/leaf.png" alt="잎" style={styles.observationSideIcon} />
                <h2 style={styles.observationSideTitle}>잎을 살펴봐요</h2>
                <p style={styles.observationSideText}>
                  색깔과 모양을 하나씩 골라 기록해요.
                </p>
              </section>

              <section style={styles.observationFormCard}>
                <div>
                  <h3 style={styles.questionTitle}>1. 잎 색깔은 어떤가요?</h3>
                  <div style={styles.choiceGrid}>
                    {leafColorOptions.map((option) =>
                      renderChoiceCard(option, leafColor, () => {
                        setLeafColor(option.label);
                        setLeafColorIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={styles.questionTitle}>2. 잎 모양은 어떤가요?</h3>
                  <div style={styles.choiceGrid}>
                    {leafShapeOptions.map((option) =>
                      renderChoiceCard(option, leafShape, () => {
                        setLeafShape(option.label);
                        setLeafShapeIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <label style={styles.memoLabel}>
                  선생님 메모 (선택)
                  <textarea
                    value={leafMemo}
                    onChange={(event) => setLeafMemo(event.target.value)}
                    placeholder="글로 쓰기 어려우면 비워도 돼요."
                    style={styles.memoTextarea}
                  />
                </label>

                {observationNotice && (
                  <div style={styles.observationNotice}>{observationNotice}</div>
                )}

                <button type="button" style={styles.saveButton} onClick={saveLeafRecord}>
                  저장하기
                </button>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "soilRecord") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("observe")}
              >
                ←
              </button>

              <img
                src={usesSproutBaseCare ? "/icons/water.png" : "/icons/soil.png"}
                alt={usesSproutBaseCare ? "바닥/물 관찰" : "흙 관찰"}
                style={styles.topBarIcon}
              />

              <div>
                <h1 style={styles.topBarTitle}>
                  {usesSproutBaseCare ? "바닥/물 관찰 기록" : "흙 관찰 기록"}
                </h1>
                <p style={styles.topBarDesc}>
                  {usesSproutBaseCare
                    ? "그림 카드를 눌러 촉촉함과 아래쪽 모습을 남겨요"
                    : "그림 카드를 눌러 흙 상태를 남겨요"}
                </p>
              </div>
            </header>

            <main style={styles.observationLayout}>
              <section style={styles.observationSideCard}>
                <img
                  src={usesSproutBaseCare ? "/icons/water.png" : "/icons/soil.png"}
                  alt={usesSproutBaseCare ? "바닥/물" : "흙"}
                  style={styles.observationSideIcon}
                />
                <h2 style={styles.observationSideTitle}>
                  {usesSproutBaseCare ? "아래쪽을 살펴봐요" : "흙을 살펴봐요"}
                </h2>
                <p style={styles.observationSideText}>
                  {usesSproutBaseCare
                    ? "키친타월이나 재배판이 촉촉한지, 물이 고이지 않았는지 기록해요."
                    : "흙의 촉촉함과 색을 골라 기록해요."}
                </p>
              </section>

              <section style={styles.observationFormCard}>
                <div>
                  <h3 style={styles.questionTitle}>
                    {usesSproutBaseCare
                      ? "1. 바닥은 촉촉한가요?"
                      : "1. 흙 상태는 어떤가요?"}
                  </h3>
                  <div style={styles.choiceGrid}>
                    {activeSoilStateOptions.map((option) =>
                      renderChoiceCard(option, soilState, () => {
                        setSoilState(option.label);
                        setSoilStateIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={styles.questionTitle}>
                    {usesSproutBaseCare
                      ? "2. 아래쪽은 어떤가요?"
                      : "2. 흙 색깔은 어떤가요?"}
                  </h3>
                  <div style={styles.choiceGrid}>
                    {activeSoilColorOptions.map((option) =>
                      renderChoiceCard(option, soilColor, () => {
                        setSoilColor(option.label);
                        setSoilColorIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <label style={styles.memoLabel}>
                  선생님 메모 (선택)
                  <textarea
                    value={soilMemo}
                    onChange={(event) => setSoilMemo(event.target.value)}
                    placeholder="글로 쓰기 어려우면 비워도 돼요."
                    style={styles.memoTextarea}
                  />
                </label>

                {observationNotice && (
                  <div style={styles.observationNotice}>{observationNotice}</div>
                )}

                <button type="button" style={styles.saveButton} onClick={saveSoilRecord}>
                  저장하기
                </button>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "photoRecord") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("observe")}
              >
                ←
              </button>

              <img src="/icons/camera.png" alt="사진 기록" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>사진 기록</h1>
                <p style={styles.topBarDesc}>사진과 함께 오늘의 변화를 남겨요</p>
              </div>
            </header>

            <main style={styles.photoRecordLayout}>
              <section style={styles.photoUploadCard}>
                <img
                  src="/icons/camera.png"
                  alt="사진"
                  style={styles.observationSideIcon}
                />

                <h2 style={styles.observationSideTitle}>사진 남기기</h2>

                <p style={styles.observationSideText}>
                  식물 사진을 찍거나 앨범에서 골라요.
                </p>

                <div style={styles.photoActionRow}>
                  <label style={styles.photoCaptureButton}>
                    사진 찍기
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoFileChange}
                      style={styles.hiddenFileInput}
                    />
                  </label>

                  <label style={styles.photoAlbumButton}>
                    앨범에서 선택
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      style={styles.hiddenFileInput}
                    />
                  </label>
                </div>

                {photoImageData ? (
                  <div style={styles.photoPreviewBox}>
                    <img
                      src={photoImageData}
                      alt="선택한 식물 사진"
                      style={styles.photoPreviewImage}
                    />

                    <button
                      type="button"
                      style={styles.removePhotoButton}
                      onClick={removePhotoImage}
                    >
                      사진 지우기
                    </button>
                  </div>
                ) : (
                  <div style={styles.emptyPhotoBox}>
                    아직 선택한 사진이 없어요.
                  </div>
                )}
              </section>

              <section style={styles.observationFormCard}>
                <div>
                  <h3 style={styles.questionTitle}>1. 어떤 변화가 보이나요?</h3>
                  <div style={styles.choiceGrid}>
                    {photoChangeOptions.map((option) =>
                      renderChoiceCard(option, photoChange, () => {
                        setPhotoChange(option.label);
                        setPhotoChangeIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={styles.questionTitle}>2. 오늘 식물은 어때 보여요?</h3>
                  <div style={styles.choiceGrid}>
                    {photoFeelingOptions.map((option) =>
                      renderChoiceCard(option, photoFeeling, () => {
                        setPhotoFeeling(option.label);
                        setPhotoFeelingIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <label style={styles.memoLabel}>
                  선생님 메모 (선택)
                  <textarea
                    value={photoMemo}
                    onChange={(event) => setPhotoMemo(event.target.value)}
                    placeholder="글로 쓰기 어려우면 비워도 돼요."
                    style={styles.memoTextarea}
                  />
                </label>

                {observationNotice && (
                  <div style={styles.observationNotice}>{observationNotice}</div>
                )}

                <button type="button" style={styles.saveButton} onClick={savePhotoRecord}>
                  저장하기
                </button>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("home")}
              >
                ←
              </button>

              <img src={mainImagePath} alt="식물 등록" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>식물 등록</h1>
                <p style={styles.topBarDesc}>관찰할 식물의 이름과 특징을 정해요</p>
              </div>
            </header>

            <main style={styles.registerLayout}>
              <section style={styles.registerPreviewCard}>
                <img
                  src={mainImagePath}
                  alt="대표 식물"
                  style={styles.registerPreviewImage}
                />

                <h2 style={styles.registerPreviewTitle}>
                  {plantName.trim() || "새 식물"}
                </h2>

                <p style={styles.registerPreviewText}>
                  {plantType.trim() || "식물 종류를 입력해 보세요."}
                </p>

                <p style={styles.registerPreviewMemo}>
                  {plantMemo.trim() ||
                    "아이들이 관찰할 내용을 짧게 적어둘 수 있어요."}
                </p>
              </section>

              <section style={styles.registerFormCard}>
                <label style={styles.formLabel}>
                  식물 이름
                  <input
                    value={plantName}
                    onChange={(event) => setPlantName(event.target.value)}
                    placeholder="예: 초록이"
                    style={styles.formInput}
                  />
                </label>

                <label style={styles.formLabel}>
                  식물 종류
                  <input
                    value={plantType}
                    onChange={(event) => {
                      setPlantType(event.target.value);
                      setDraftStatus({
                        tone: "idle",
                        text: "식물 종류가 바뀌었어요. 자동 초안을 다시 불러올 수 있어요.",
                      });
                    }}
                    placeholder="예: 몬스테라, 강낭콩, 상추"
                    style={styles.formInput}
                  />
                </label>

                <div style={styles.teacherQuickBox}>
                  <div>
                    <p style={styles.teacherQuickTitle}>식물 정보 자동 초안</p>
                    <p style={styles.teacherQuickText}>
                      자동 초안을 확인하고 저장하면 아이 질문 답변에 먼저 사용돼요.
                    </p>
                  </div>

                  <button
                    type="button"
                    style={styles.draftButton}
                    disabled={isTeacherDraftLoading}
                    onClick={loadTeacherInfoDraft}
                  >
                    {isTeacherDraftLoading ? "불러오는 중" : "자동 정보 불러오기"}
                  </button>
                </div>

                <div style={draftStatusStyle}>
                  <span style={styles.draftStatusDot} />
                  <span>{draftStatus.text}</span>
                </div>

                <label style={styles.formLabel}>
                  관찰 메모
                  <textarea
                    value={plantMemo}
                    onChange={(event) => setPlantMemo(event.target.value)}
                    placeholder="예: 오늘 처음 만난 식물이에요."
                    style={styles.formTextarea}
                  />
                </label>

                <div style={styles.teacherInfoBox}>
                  <div style={styles.teacherInfoHeader}>
                    <div>
                      <h3 style={styles.teacherInfoTitle}>교사 확인 정보</h3>
                      <p style={styles.teacherInfoDesc}>
                        자동 초안을 확인하고 저장하면 아이 질문 답변에 먼저 사용돼요.
                      </p>
                    </div>

                    <button
                      type="button"
                      style={styles.draftButton}
                      disabled={isTeacherDraftLoading}
                      onClick={loadTeacherInfoDraft}
                    >
                      {isTeacherDraftLoading ? "불러오는 중" : "자동 초안"}
                    </button>
                  </div>

                  <label style={styles.formLabel}>
                    식물 설명
                    <textarea
                      value={teacherSummary}
                      onChange={(event) => setTeacherSummary(event.target.value)}
                      placeholder="예: 바질은 잎 향과 새 잎을 관찰하기 좋은 식물이에요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    원산지/사는 곳
                    <textarea
                      value={teacherOriginInfo}
                      onChange={(event) =>
                        setTeacherOriginInfo(event.target.value)
                      }
                      placeholder="예: 따뜻한 지역에서 많이 자라며, 실내에서도 밝은 곳을 좋아해요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    식물 종류/분류
                    <textarea
                      value={teacherClassificationInfo}
                      onChange={(event) =>
                        setTeacherClassificationInfo(event.target.value)
                      }
                      placeholder="예: 향이 나는 잎을 가진 허브 식물이에요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    이름 유래/기본 지식
                    <textarea
                      value={teacherNameStoryInfo}
                      onChange={(event) =>
                        setTeacherNameStoryInfo(event.target.value)
                      }
                      placeholder="예: 이름은 잎의 향이나 모양에서 온 경우가 있어요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    먹는 정보
                    <textarea
                      value={teacherEdibleInfo}
                      onChange={(event) => setTeacherEdibleInfo(event.target.value)}
                      placeholder="예: 잎을 먹는 식물로 알려져 있지만, 먹기 전에는 확인이 필요해요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    꽃 정보
                    <textarea
                      value={teacherFlowerInfo}
                      onChange={(event) => setTeacherFlowerInfo(event.target.value)}
                      placeholder="예: 자라면 꽃이 필 수 있어요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    열매/씨앗 정보
                    <textarea
                      value={teacherFruitInfo}
                      onChange={(event) => setTeacherFruitInfo(event.target.value)}
                      placeholder="예: 꽃 뒤에 씨앗이나 열매 변화가 생길 수 있어요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    관찰 포인트
                    <textarea
                      value={teacherObservationPoints}
                      onChange={(event) =>
                        setTeacherObservationPoints(event.target.value)
                      }
                      placeholder="예: 잎 색, 잎 냄새, 새 잎, 흙 상태"
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    주의사항
                    <textarea
                      value={teacherCaution}
                      onChange={(event) => setTeacherCaution(event.target.value)}
                      placeholder="예: 선생님 없이 먹거나 꺾지 않아요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    성장 정보
                    <textarea
                      value={teacherGrowthInfo}
                      onChange={(event) => setTeacherGrowthInfo(event.target.value)}
                      placeholder="예: 줄기가 길어지고 잎이 늘어나는 모습을 비교해요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    돌봄 정보
                    <textarea
                      value={teacherCareInfo}
                      onChange={(event) => setTeacherCareInfo(event.target.value)}
                      placeholder="예: 흙이 마른 정도와 잎 상태를 보고 물을 조절해요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    권장 물 주기
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={teacherWaterIntervalDays}
                      onChange={(event) =>
                        setTeacherWaterIntervalDays(
                          clampNumber(event.target.value, 2, 1, 14)
                        )
                      }
                      style={styles.formInput}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    하루 햇빛 보기 목표
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={teacherSunGoal}
                      onChange={(event) =>
                        setTeacherSunGoal(
                          clampNumber(event.target.value, 1, 1, 5)
                        )
                      }
                      style={styles.formInput}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    돌봄 체크리스트
                    <textarea
                      value={teacherCareChecklist}
                      onChange={(event) =>
                        setTeacherCareChecklist(event.target.value)
                      }
                      placeholder="예: 흙 만져보기, 잎 처짐 보기, 햇빛 자리 확인하기"
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    빛/자리 정보
                    <textarea
                      value={teacherLightInfo}
                      onChange={(event) => setTeacherLightInfo(event.target.value)}
                      placeholder="예: 밝지만 잎이 뜨거워지지 않는 자리가 좋아요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    환경 정보
                    <textarea
                      value={teacherEnvironmentInfo}
                      onChange={(event) =>
                        setTeacherEnvironmentInfo(event.target.value)
                      }
                      placeholder="예: 따뜻한 실내에서 잘 지내고, 겨울에는 찬바람을 피해야 해요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    시기/수명 정보
                    <textarea
                      value={teacherLifecycleInfo}
                      onChange={(event) =>
                        setTeacherLifecycleInfo(event.target.value)
                      }
                      placeholder="예: 오래 살 수 있지만 환경이 맞지 않으면 잎이 노랗게 변하거나 시들 수 있어요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    향 정보
                    <textarea
                      value={teacherSmellInfo}
                      onChange={(event) => setTeacherSmellInfo(event.target.value)}
                      placeholder="예: 잎이나 꽃에서 향을 관찰할 수 있어요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    좋아하는 것
                    <textarea
                      value={teacherFavoriteInfo}
                      onChange={(event) => setTeacherFavoriteInfo(event.target.value)}
                      placeholder="예: 알맞은 물과 밝은 빛, 조심스러운 관찰을 좋아해요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    힘들어하는 것
                    <textarea
                      value={teacherDislikeInfo}
                      onChange={(event) => setTeacherDislikeInfo(event.target.value)}
                      placeholder="예: 흙이 너무 마르거나 잎이 뜨거워지는 걸 힘들어해요."
                      style={styles.teacherTextarea}
                    />
                  </label>

                  <label style={styles.formLabel}>
                    아이 답변 힌트
                    <textarea
                      value={teacherChildAnswerHints}
                      onChange={(event) =>
                        setTeacherChildAnswerHints(event.target.value)
                      }
                      placeholder="예: 안전이 필요한 질문은 선생님 확인을 먼저 안내해요."
                      style={styles.teacherTextarea}
                    />
                  </label>
                </div>

                <div style={styles.registerButtonRow}>
                  {plant && (
                    <button
                      type="button"
                      style={styles.deleteButton}
                      onClick={deletePlant}
                    >
                      삭제하기
                    </button>
                  )}

                  <button type="button" style={styles.saveButton} onClick={savePlant}>
                    저장하기
                  </button>
                </div>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "chat") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("home")}
              >
                ←
              </button>

              <img src={logoPath} alt="대화" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>{plantDisplayName}와 대화</h1>
                <p style={styles.topBarDesc}>식물에게 궁금한 것을 물어봐요</p>
              </div>
            </header>

            <main style={styles.chatLayout}>
              <section style={styles.chatPlantPanel}>
                <img
                  src={mainImagePath}
                  alt={plantDisplayName}
                  style={styles.chatPlantImage}
                />

                <h2 style={styles.chatPlantName}>{plantDisplayName}</h2>

                <p style={styles.chatPlantDesc}>
                  오늘도 나를 관찰해줘서 고마워!
                </p>
              </section>

              <section style={styles.chatMainPanel}>
                <div ref={chatMessageListRef} style={styles.chatMessageList}>
                  <div style={styles.speechBubble}>
                    <div>
                      안녕! 나는 {plantDisplayName}야. 오늘 나에게 궁금한 걸 물어봐.
                    </div>
                    <button
                      type="button"
                      style={styles.readButton}
                      disabled={Boolean(loadingAudioId)}
                      onClick={() =>
                        readingMessageId === "intro"
                          ? stopSpeaking()
                          : speakText(
                              "안녕! 오늘 나에게 궁금한 걸 물어봐.",
                              "intro"
                            )
                      }
                    >
                      {readingMessageId === "intro"
                        ? "멈추기"
                        : loadingAudioId === "intro"
                          ? "준비 중"
                          : "읽어주기"}
                    </button>
                  </div>

                  {hiddenChatMessageCount > 0 && (
                    <div style={styles.chatHistoryNotice}>
                      이전 대화 {hiddenChatMessageCount}개는 저장되어 있어요.
                    </div>
                  )}

                  {visibleChatMessages.map((chatMessage) => (
                    <div key={chatMessage.id} style={styles.chatTurn}>
                      <div style={styles.questionBubble}>
                        <span style={styles.chatBubbleLabel}>질문</span>
                        {chatMessage.childName && (
                          <span style={styles.chatChildName}>
                            {chatMessage.childName}
                          </span>
                        )}
                        {chatMessage.question}
                      </div>

                      <div style={styles.answerBubble}>
                        <div>
                          <span style={styles.answerBubbleLabel}>
                            {plantDisplayName} 답변
                          </span>
                          {chatMessage.answer}
                        </div>
                        <div style={styles.answerActions}>
                          <button
                            type="button"
                            style={styles.readButton}
                            disabled={Boolean(loadingAudioId)}
                            onClick={() =>
                              readingMessageId === chatMessage.id
                                ? stopSpeaking()
                                : speakText(chatMessage.answer, chatMessage.id)
                            }
                          >
                            {readingMessageId === chatMessage.id
                              ? "멈추기"
                              : loadingAudioId === chatMessage.id
                                ? "준비 중"
                              : "읽어주기"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div ref={chatEndRef} style={styles.chatScrollAnchor} />
                </div>

                <div style={styles.chatComposer}>
                  <div style={styles.exampleBox}>
                    <p style={styles.exampleTitle}>자주 묻는 질문</p>
                    <div style={styles.quickQuestionGrid}>
                      {QUICK_CHAT_QUESTIONS.map((quickQuestion) => (
                        <button
                          key={quickQuestion}
                          type="button"
                          style={styles.quickQuestionButton}
                          onClick={() => {
                            setMessage(quickQuestion);
                            void handleSendMessage(quickQuestion);
                          }}
                        >
                          {quickQuestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {speechError && (
                    <div style={styles.speechErrorNotice}>{speechError}</div>
                  )}

                  <form
                    style={styles.inputArea}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSendMessage(
                        messageInputRef.current?.value ?? message
                      );
                    }}
                  >
                    <input
                      ref={messageInputRef}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder="식물에게 물어보세요..."
                      style={styles.input}
                    />

                    <button
                      type="button"
                      style={styles.voiceButton}
                      onClick={
                        isListening ? stopVoiceQuestion : startVoiceQuestion
                      }
                    >
                      {isListening ? "듣는 중" : "말하기"}
                    </button>

                    <button
                      type="submit"
                      style={styles.sendButton}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        void handleSendMessage(
                          messageInputRef.current?.value ?? message
                        );
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleSendMessage(
                          messageInputRef.current?.value ?? message
                        );
                      }}
                    >
                      보내기
                    </button>
                  </form>
                </div>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "answerTest") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          {renderMotionStyles()}

          <div style={styles.screenContent}>
            {renderTopBar(
              "답변 테스트",
              "아이들이 할 만한 질문에 식물이 어떻게 답하는지 확인해요"
            )}

            <main style={styles.answerTestLayout}>
              <section style={styles.answerTestIntro}>
                <div>
                  <p style={styles.sectionLabel}>현재 기준</p>
                  <h2 style={styles.answerTestTitle}>{plantDisplayName}</h2>
                  <p style={styles.answerTestDesc}>
                    {plantDisplayType} 정보와 최근 관찰 기록을 바탕으로 답변을
                    미리 보여줘요.
                  </p>
                </div>

                <button
                  type="button"
                  style={styles.saveButton}
                  onClick={() => setScreen("chat")}
                >
                  채팅에서 확인하기
                </button>
              </section>

              <section style={styles.answerTestGrid}>
                {answerTestScenarios.map((scenario, index) => (
                  <article
                    key={scenario.question}
                    className="plant-talk-test-card"
                    style={{
                      ...styles.answerTestCard,
                      animationDelay: `${index * 0.035}s`,
                    }}
                  >
                    <div style={styles.answerTestCardHeader}>
                      <span style={styles.answerTestCategory}>
                        {scenario.category}
                      </span>
                      <span style={styles.answerTestCheck}>교사 확인</span>
                    </div>

                    <p style={styles.answerTestQuestion}>{scenario.question}</p>
                    <p style={styles.answerTestFocus}>{scenario.focus}</p>
                    <p style={styles.answerTestAnswer}>
                      {plantDisplayName}: {createPlantAnswer(scenario.question)}
                    </p>
                  </article>
                ))}
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "observe") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            {renderTopBar("관찰", "식물의 모습을 자세히 살펴봐요")}

            <main style={styles.tabMainLayout}>
              <section style={styles.sideInfoCard}>
                <img
                  src="/icons/observe.png"
                  alt="관찰"
                  style={styles.sideInfoIcon}
                />

                <h2 style={styles.sideInfoTitle}>오늘은 무엇을 볼까요?</h2>

                <p style={styles.sideInfoText}>
                  사진, 잎, 흙을 차례대로 살펴보면 식물의 변화를 더 잘 알 수 있어요.
                </p>
              </section>

              <section style={styles.horizontalCardGrid}>
                {observeCards.map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    style={styles.largeFeatureCard}
                    onClick={card.action}
                  >
                    <img src={card.icon} alt={card.title} style={styles.featureIcon} />
                    <h3 style={styles.featureTitle}>{card.title}</h3>
                    <p style={styles.featureDesc}>{card.desc}</p>
                  </button>
                ))}
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "care") {
    const waterDone = waterDoneToday;
    const sunDone = todaySunCount >= careState.sunGoal;

    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          {renderMotionStyles()}

          <div style={styles.screenContent}>
            {renderTopBar("돌보기", "물 주기와 햇빛 보기를 횟수로 세요")}

            <main style={styles.careLayout}>
              <section style={styles.sideInfoCard}>
                <img src="/icons/care.png" alt="돌보기" style={styles.sideInfoIcon} />

                <h2 style={styles.sideInfoTitle}>오늘의 돌보기</h2>

                <p style={styles.careSpeechText}>
                  {plantWaterSpeech}
                </p>

                <div style={styles.careSimpleCheck}>
                  <span style={styles.careSimpleCheckLabel}>오늘 볼 것</span>
                  <strong style={styles.careSimpleCheckText}>{careFocusText}</strong>
                </div>

                <div style={styles.waterReminderBox}>
                  <span style={styles.waterReminderLabel}>다음 물 주기</span>
                  <strong style={styles.waterReminderText}>{nextWateringText}</strong>

                  <div style={styles.goalControl}>
                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={decreaseWaterInterval}
                    >
                      -
                    </button>

                    <span style={styles.goalText}>
                      {careState.waterIntervalDays}일마다
                    </span>

                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={increaseWaterInterval}
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  style={styles.resetButton}
                  onClick={resetTodayCounts}
                >
                  오늘 횟수 초기화
                </button>
              </section>

              <section style={styles.careCardRow}>
                <div
                  style={styles.careCard}
                  className={
                    careMotion === "water" ? "plant-talk-water-active" : ""
                  }
                >
                  <div style={styles.careMotionStage}>
                    <span
                      className="plant-talk-drop"
                      style={{ ...styles.waterDrop, left: "56%" }}
                    />
                    <span
                      className="plant-talk-drop"
                      style={{ ...styles.waterDrop, left: "66%" }}
                    />
                    <span
                      className="plant-talk-drop"
                      style={{ ...styles.waterDrop, left: "76%" }}
                    />
                    <img
                      src="/icons/water.png"
                      alt="물 주기"
                      className="plant-talk-water-can"
                      style={styles.careMotionTool}
                    />
                    <img
                      src={mainImagePath}
                      alt={plantDisplayName}
                      className="plant-talk-care-plant"
                      style={styles.careMotionPlant}
                    />
                  </div>

                  <h3 style={styles.careTitle}>물 주기</h3>

                  <p style={waterDone ? styles.doneStatusText : styles.statusText}>
                    {todayWaterCount} / {careState.waterGoal}회
                  </p>

                  <div style={styles.goalControl}>
                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => decreaseGoal("waterGoal")}
                    >
                      -
                    </button>

                    <span style={styles.goalText}>목표 {careState.waterGoal}회</span>

                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => increaseGoal("waterGoal")}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    style={waterDone ? styles.countButtonDone : styles.countButton}
                    onClick={() => increaseCount("waterCount")}
                  >
                    물 줬어요
                  </button>
                </div>

                <div
                  style={styles.careCard}
                  className={careMotion === "sun" ? "plant-talk-sun-active" : ""}
                >
                  <div style={styles.careMotionStage}>
                    <img
                      src="/icons/sun.png"
                      alt="햇빛 보기"
                      className="plant-talk-sun"
                      style={styles.careMotionSun}
                    />
                    <img
                      src={mainImagePath}
                      alt={plantDisplayName}
                      className="plant-talk-care-plant"
                      style={styles.careMotionPlant}
                    />
                  </div>

                  <h3 style={styles.careTitle}>햇빛 보기</h3>

                  <p style={sunDone ? styles.doneStatusText : styles.statusText}>
                    {todaySunCount} / {careState.sunGoal}회
                  </p>

                  <div style={styles.goalControl}>
                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => decreaseGoal("sunGoal")}
                    >
                      -
                    </button>

                    <span style={styles.goalText}>목표 {careState.sunGoal}회</span>

                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => increaseGoal("sunGoal")}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    style={sunDone ? styles.countButtonDone : styles.countButton}
                    onClick={() => increaseCount("sunCount")}
                  >
                    햇빛 봤어요
                  </button>
                </div>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "record") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          {renderMotionStyles()}

          <div style={styles.screenContent}>
            {renderTopBar("기록", "관찰한 내용을 모아봐요")}

            <main style={styles.recordLayout}>
              <section style={styles.sideInfoCard}>
                <img src="/icons/record.png" alt="기록" style={styles.sideInfoIcon} />

                <h2 style={styles.sideInfoTitle}>기록 모음</h2>

                <p style={styles.sideInfoText}>
                  오늘 기록과 지난 기록을 사진, 잎, 흙, 기타로 나누어 볼 수 있어요.
                </p>
              </section>

              <section style={styles.recordListPanel}>
                <div style={styles.todayRecordHeader}>
                  <div>
                    <p style={styles.todayRecordLabel}>저장된 전체 기록</p>
                    <h2 style={styles.todayRecordDate}>
                      {selectedRecordDateKey === "all"
                        ? "전체 날짜"
                        : formatDateKey(selectedRecordDateKey)}
                    </h2>
                  </div>

                  <span style={styles.todayRecordCount}>
                    오늘 {todayRecords.length}개 · 지난 기록 {pastRecords.length}개
                  </span>
                </div>

                {recordSaveNotice && (
                  <div style={styles.recordSaveNotice}>
                    <span style={styles.recordSaveIcon}>완료</span>
                    <strong>{recordSaveNotice}</strong>
                  </div>
                )}

                {photoAnalysisNotice && (
                  <div style={styles.photoAnalysisNotice}>
                    {photoAnalysisNotice}
                  </div>
                )}

                <div style={styles.recordSummaryTabs}>
                  {[
                    ["records", "흙·잎·사진"],
                    ["weekly", "이번 주 변화"],
                    ["photos", "사진 비교"],
                    ["attention", "주의 기록"],
                  ].map(([tabKey, label]) => (
                    <button
                      key={tabKey}
                      type="button"
                      style={
                        recordSummaryTab === tabKey
                          ? styles.recordSummaryTabActive
                          : styles.recordSummaryTab
                      }
                      onClick={() =>
                        setRecordSummaryTab(
                          tabKey as "records" | "weekly" | "photos" | "attention"
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {recordSummaryTab === "weekly" && (
                <section style={styles.weeklySummaryBox}>
                  <div style={styles.weeklySummaryHeader}>
                    <div>
                      <p style={styles.attentionLabel}>교사용 주간 요약</p>
                      <h3 style={styles.attentionTitle}>이번 주 변화</h3>
                    </div>

                    <span style={styles.attentionCount}>
                      최근 7일 {weeklyRecords.length}개
                    </span>
                  </div>

                  <div style={styles.weeklyMetricGrid}>
                    <div style={styles.weeklyMetricCard}>
                      <strong>{weeklyPhotoRecords.length}</strong>
                      <span>사진</span>
                    </div>
                    <div style={styles.weeklyMetricCard}>
                      <strong>{weeklyLeafRecords.length}</strong>
                      <span>잎</span>
                    </div>
                    <div style={styles.weeklyMetricCard}>
                      <strong>{weeklySoilRecords.length}</strong>
                      <span>흙</span>
                    </div>
                    <div style={styles.weeklyMetricCard}>
                      <strong>{weeklyAttentionRecords.length}</strong>
                      <span>주의</span>
                    </div>
                  </div>

                  <p style={styles.weeklySummaryText}>{weeklyGrowthText}</p>

                  <div style={styles.weeklyFocusList}>
                    {weeklyTeacherFocus.map((focus) => (
                      <span key={focus} style={styles.weeklyFocusItem}>
                        {focus}
                      </span>
                    ))}
                  </div>
                </section>
                )}

                {recordSummaryTab === "photos" && (
                <section style={styles.photoCompareBox}>
                  <div style={styles.photoCompareHeader}>
                    <div>
                      <p style={styles.attentionLabel}>사진으로 보기</p>
                      <h3 style={styles.attentionTitle}>성장 비교</h3>
                    </div>

                    <button
                      type="button"
                      style={styles.photoAiButton}
                      onClick={() => setScreen("photoRecord")}
                    >
                      사진 남기기
                    </button>
                  </div>

                  {newestPhotoRecord?.imageData ? (
                    <div style={styles.photoCompareGrid}>
                      <div style={styles.photoCompareItem}>
                        <span style={styles.photoCompareLabel}>
                          {hasPhotoComparison ? "처음 사진" : "최근 사진"}
                        </span>
                        <img
                          src={
                            hasPhotoComparison
                              ? firstPhotoRecord?.imageData
                              : newestPhotoRecord.imageData
                          }
                          alt="처음 식물 사진"
                          style={styles.photoCompareImage}
                        />
                        <strong style={styles.photoCompareCaption}>
                          {hasPhotoComparison
                            ? firstPhotoRecord?.date
                            : newestPhotoRecord.date}
                        </strong>
                      </div>

                      <div style={styles.photoCompareItem}>
                        <span style={styles.photoCompareLabel}>
                          {hasPhotoComparison ? "최근 사진" : "다음 비교"}
                        </span>
                        {hasPhotoComparison ? (
                          <img
                            src={newestPhotoRecord.imageData}
                            alt="최근 식물 사진"
                            style={styles.photoCompareImage}
                          />
                        ) : (
                          <button
                            type="button"
                            style={styles.photoCompareEmpty}
                            onClick={() => setScreen("photoRecord")}
                          >
                            다음 사진을 남기면 비교할 수 있어요.
                          </button>
                        )}
                        <strong style={styles.photoCompareCaption}>
                          {hasPhotoComparison
                            ? newestPhotoRecord.date
                            : "사진을 하나 더 남겨요"}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      style={styles.photoCompareEmpty}
                      onClick={() => setScreen("photoRecord")}
                    >
                      아직 사진 기록이 없어요. 오늘 사진을 남겨볼까요?
                    </button>
                  )}
                </section>
                )}

                {recordSummaryTab === "attention" && (
                <section style={styles.attentionBox}>
                  <div style={styles.attentionHeader}>
                    <div>
                      <p style={styles.attentionLabel}>교사 확인</p>
                      <h3 style={styles.attentionTitle}>주의 기록</h3>
                    </div>

                    <span style={styles.attentionCount}>
                      {attentionRecords.length}개
                    </span>
                  </div>

                  {attentionRecords.length === 0 ? (
                    <div style={styles.attentionEmpty}>
                      지금은 바로 확인할 주의 기록이 없어요.
                    </div>
                  ) : (
                    <div style={styles.attentionList}>
                      {attentionRecords.map(({ record, reason, action, icon }) => (
                        <article key={record.id} style={styles.attentionItem}>
                          <img
                            src={icon}
                            alt={record.title}
                            style={styles.attentionIcon}
                          />

                          <div style={styles.attentionTextBox}>
                            <p style={styles.attentionDate}>
                              {record.date} · {record.title}
                            </p>
                            <strong style={styles.attentionReason}>
                              {reason}
                            </strong>
                            <p style={styles.attentionAction}>{action}</p>
                            <div style={styles.attentionActionRow}>
                              <span style={styles.attentionStatusPill}>
                                해결 확인 필요
                              </span>
                              <button
                                type="button"
                                style={styles.attentionFollowButton}
                                onClick={() => {
                                  if (record.type === "leaf") {
                                    setScreen("leafRecord");
                                  } else if (record.type === "soil") {
                                    setScreen("soilRecord");
                                  } else {
                                    setScreen("photoRecord");
                                  }
                                }}
                              >
                                다음 관찰로 확인
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                )}

                {recordSummaryTab === "records" && (
                <>
                <div style={styles.recordDateFilterBox}>
                  <input
                    type="date"
                    value={
                      selectedRecordDateKey === "all"
                        ? todayKey
                        : selectedRecordDateKey
                    }
                    onChange={(event) =>
                      setSelectedRecordDateKey(event.target.value)
                    }
                    style={styles.recordDateInput}
                  />

                  <button
                    type="button"
                    style={styles.recordDateFilterButton}
                    onClick={() => setSelectedRecordDateKey(todayKey)}
                  >
                    오늘 보기
                  </button>

                  <button
                    type="button"
                    style={styles.recordDateFilterButton}
                    onClick={() => setSelectedRecordDateKey("all")}
                  >
                    전체 보기
                  </button>
                </div>

                <div style={styles.recordCategoryStack}>
                  {renderRecordGroup(
                    "흙",
                    "/icons/soil.png",
                    soilRecords,
                    "아직 흙 관찰 기록이 없어요."
                  )}

                  {renderRecordGroup(
                    "잎",
                    "/icons/leaf.png",
                    leafRecords,
                    "아직 잎 관찰 기록이 없어요."
                  )}

                  {renderRecordGroup(
                    "사진",
                    "/icons/camera.png",
                    photoRecords,
                    "아직 사진 기록이 없어요."
                  )}

                  {renderRecordGroup(
                    "기타",
                    "/icons/note.png",
                    otherRecords,
                    "아직 기타 기록이 없어요."
                  )}
                </div>
                </>
                )}
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "analysis") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          {renderMotionStyles()}

          <div style={styles.screenContent}>
            {renderTopBar("분석", "아이별 기록을 누리과정 관점으로 살펴봐요")}

            <main style={styles.recordLayout}>
              <section style={styles.sideInfoCard}>
                <img src="/icons/growth.png" alt="분석" style={styles.sideInfoIcon} />

                <h2 style={styles.sideInfoTitle}>개별 아이 분석</h2>

                <p style={styles.sideInfoText}>
                  아이를 선택하면 그 아이의 관찰 기록과 질문만 모아 자연탐구,
                  의사소통 하위범주로 정리해요.
                </p>

                <button
                  type="button"
                  style={styles.primarySideButton}
                  onClick={addChildToRoster}
                >
                  아이 추가
                </button>
              </section>

              <section style={styles.recordListPanel}>
                <div style={styles.analysisTabs}>
                  {[
                    ["report", "개별 분석"],
                    ["roster", "반 아이 목록"],
                    ["participation", "참여 빈도"],
                  ].map(([tabKey, label]) => (
                    <button
                      key={tabKey}
                      type="button"
                      style={
                        analysisTab === tabKey
                          ? styles.analysisTabActive
                          : styles.analysisTab
                      }
                      onClick={() =>
                        setAnalysisTab(
                          tabKey as "report" | "roster" | "participation"
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {analysisTab === "roster" && (
                <section style={styles.analysisRosterBox}>
                  <div>
                    <p style={styles.attentionLabel}>반 아이 목록</p>
                    <h3 style={styles.attentionTitle}>
                      {knownChildNames.length > 0
                        ? `${knownChildNames.length}명`
                        : "아이를 먼저 추가해 주세요"}
                    </h3>
                  </div>

                  {knownChildNames.length > 0 ? (
                    <>
                      <input
                        value={analysisChildFilter}
                        onChange={(event) => setAnalysisChildFilter(event.target.value)}
                        placeholder="아이 이름 검색"
                        style={styles.analysisChildSearchInput}
                      />

                      <div style={styles.analysisChildChipWrap}>
                        {analysisVisibleChildNames.length > 0 ? (
                          analysisVisibleChildNames.map((childName) => {
                            const participation = childParticipationRows.find(
                              (row) => row.childName === childName
                            );

                            return (
                              <button
                                key={childName}
                                type="button"
                                style={
                                  childName === currentChildName
                                    ? styles.analysisChildChipActive
                                    : styles.analysisChildChip
                                }
                                onClick={() => selectChildName(childName)}
                              >
                                <strong style={styles.analysisChildChipName}>
                                  {childName}
                                </strong>
                                <span style={styles.analysisChildChipMeta}>
                                  기록 {participation?.recordCount ?? 0} · 질문{" "}
                                  {participation?.questionCount ?? 0}
                                </span>
                                <span style={styles.childParticipationBarTrack}>
                                  <span
                                    style={{
                                      ...styles.childParticipationBarFill,
                                      width: `${Math.min(
                                        100,
                                        ((participation?.total ?? 0) / 5) * 100
                                      )}%`,
                                    }}
                                  />
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <span style={styles.analysisChildNoResult}>
                            맞는 아이 이름이 없어요.
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={styles.curriculumEmpty}>
                      상단의 아이 추가 버튼으로 반 아이 이름을 한 번만 넣어두면
                      이후에는 선택만 하면 돼요.
                    </div>
                  )}
                </section>
                )}

                {analysisTab === "participation" && (
                <section style={styles.participationBox}>
                  <div style={styles.curriculumReportHeader}>
                    <div>
                      <p style={styles.attentionLabel}>운영 체크</p>
                      <h3 style={styles.attentionTitle}>아이별 참여 빈도</h3>
                    </div>

                    <span style={styles.attentionCount}>
                      참여 {weeklyParticipantCount}명 · 미참여{" "}
                      {childrenWithoutWeeklyParticipation.length}명
                    </span>
                  </div>

                  {childParticipationRows.length === 0 ? (
                    <div style={styles.curriculumEmpty}>
                      아이를 추가하면 이번 주 참여 빈도와 누적 참여를 한눈에 볼 수 있어요.
                    </div>
                  ) : (
                    <div style={styles.participationGroupStack}>
                      {participationGroups.map((group) => (
                        <div key={group.title} style={styles.participationGroup}>
                          <div style={styles.participationGroupHeader}>
                            <strong>{group.title}</strong>
                            <span>{group.rows.length}명</span>
                          </div>

                          {group.rows.length === 0 ? (
                            <p style={styles.participationEmptyLine}>없어요</p>
                          ) : (
                            <div style={styles.participationChipWrap}>
                              {group.rows.map((row) => (
                                <button
                                  key={row.childName}
                                  type="button"
                                  style={
                                    row.childName === currentChildName
                                      ? styles.participationChipActive
                                      : styles.participationChip
                                  }
                                  onClick={() => selectChildName(row.childName)}
                                >
                                  {row.childName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {hasSelectedChild && selectedParticipation && (
                    <div style={styles.selectedParticipationBox}>
                      <strong>{activeChildName} 참여 상세</strong>
                      <span>
                        이번 주 {selectedParticipation.weeklyActiveDays}일 · 누적{" "}
                        {selectedParticipation.total}회 · 마지막{" "}
                        {selectedParticipation.lastDateText}
                      </span>
                    </div>
                  )}

                  {childrenWithoutWeeklyParticipation.length > 0 && (
                    <p style={styles.participationHint}>
                      다음 활동 추천: {childrenWithoutWeeklyParticipation
                        .map((row) => row.childName)
                        .slice(0, 4)
                        .join(", ")}
                      {childrenWithoutWeeklyParticipation.length > 4 ? " 외" : ""}에게 먼저
                      사진이나 잎 관찰을 맡겨보세요.
                    </p>
                  )}
                </section>
                )}

                {analysisTab === "report" && (
                <section style={styles.curriculumReportBox}>
                  <div style={styles.curriculumReportHeader}>
                    <div>
                      <p style={styles.attentionLabel}>개별 아이 분석</p>
                      <h3 style={styles.attentionTitle}>
                        {hasSelectedChild
                          ? `${activeChildName} 누리과정 관찰`
                          : "아이를 선택해 주세요"}
                      </h3>
                    </div>

                    <span style={styles.attentionCount}>
                      기록 {activeChildRecords.length}개 · 질문{" "}
                      {activeChildMessages.length}개
                    </span>
                  </div>

                  {hasSelectedChild ? (
                    <div style={styles.curriculumReportGrid}>
                      <div style={styles.curriculumAreaCard}>
                        <h4 style={styles.curriculumAreaTitle}>자연탐구</h4>
                        {childCurriculumReport.naturalInquiry.map((item) => (
                          <div key={item.title} style={styles.curriculumItem}>
                            <strong style={styles.curriculumItemTitle}>
                              {item.title}
                            </strong>
                            <p style={styles.curriculumItemText}>{item.text}</p>
                          </div>
                        ))}
                      </div>

                      <div style={styles.curriculumAreaCard}>
                        <h4 style={styles.curriculumAreaTitle}>의사소통</h4>
                        {childCurriculumReport.communication.map((item) => (
                          <div key={item.title} style={styles.curriculumItem}>
                            <strong style={styles.curriculumItemTitle}>
                              {item.title}
                            </strong>
                            <p style={styles.curriculumItemText}>{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={styles.curriculumEmpty}>
                      아이를 선택하면 그 아이의 기록과 질문만 모아 자연탐구,
                      의사소통 하위범주로 분석해요.
                    </div>
                  )}
                </section>
                )}
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.landscapeFrame}>
        {renderMotionStyles()}

        <div style={styles.screenContent}>
          {renderTopBar("식물talk", "오늘 식물에게 말을 걸어볼까요?")}

          <main style={styles.homeLayout}>
            <section style={styles.homeLeftColumn}>
              <div style={styles.dateCard}>
                <div>
                  <p style={styles.dateLabel}>오늘 날짜</p>
                  <h2 style={styles.dateText}>{todayLabel}</h2>
                </div>

                <img src={dateIconPath} alt="오늘 날짜" style={styles.dateIcon} />
              </div>

              {/* 식물 정보 카드 */}
              <div style={styles.myPlantCard}>
                <div style={styles.myPlantTextBox}>
                  <div style={styles.myPlantTopLine}>
                    <p style={styles.sectionLabel}>
                      {hasSelectedChild ? `${activeChildName}의 식물` : "나의 식물"}
                    </p>
                    <button
                      type="button"
                      style={styles.editPlantButton}
                      onClick={() => setScreen("register")}
                    >
                      {plant ? "수정" : "등록"}
                    </button>
                  </div>
                  <h2 style={styles.myPlantName}>{plantDisplayName}</h2>
                  <p style={styles.myPlantType}>{plantDisplayType}</p>
                  <p style={styles.myPlantDesc}>{plantDisplayMemo}</p>
                </div>
                <button
                  type="button"
                  style={styles.myPlantImageButton}
                  onClick={() => speakText(plantStatusSpeech, "plant-status")}
                  title="식물 상태 듣기"
                >
                  <img src={mainImagePath} alt={plantDisplayName} style={styles.myPlantImage} />
                  <span style={styles.myPlantListenHint}>
                    {readingMessageId === "plant-status" ? "말하는 중 🔊" : "눌러봐요 👂"}
                  </span>
                </button>
              </div>

              {/* 돌봐줘요 카드 */}
              <div style={styles.todayCard}>
                <p style={styles.sectionLabel}>💧 돌봐주세요</p>
                <div style={plantNeedsAttention ? styles.homeWaterCounterAlert : styles.homeWaterCounterReady}>
                  <div
                    style={styles.homeWaterMiniStage}
                    className={careMotion === "water" ? "plant-talk-water-active" : ""}
                  >
                    <img src={mainImagePath} alt={plantDisplayName} className="plant-talk-care-plant" style={styles.homeWaterPlantIcon} />
                    <img src="/icons/water.png" alt="" className="plant-talk-water-can" style={styles.homeWaterDropIcon} />
                  </div>
                  <div style={styles.homeWaterCounterTextBox}>
                    <strong style={styles.homeWaterCounterTitle}>물 주기</strong>
                    <span style={styles.homeWaterCounterCount}>{todayWaterCount} / {careState.waterGoal}회</span>
                    <span style={styles.homeWaterLabel}>{nextWateringText}</span>
                  </div>
                  <strong style={styles.homeWaterSpeech}>
                    {plantDisplayName}: {plantWaterSpeech}
                  </strong>
                  <button
                    type="button"
                    style={waterNeedsCare && !waterDoneToday ? styles.homeWaterActionButton : styles.homeWaterActionButtonDisabled}
                    onClick={() => { if (waterNeedsCare && !waterDoneToday) increaseCount("waterCount"); }}
                    disabled={!waterNeedsCare || waterDoneToday}
                  >
                    {waterDoneToday ? "완료" : waterNeedsCare ? "물 줬어요" : "아직 괜찮아요"}
                  </button>
                </div>
              </div>
            </section>

            <section style={styles.homeRightColumn}>
              {/* 대화 버튼 — 왼쪽 식물 카드와 같은 공간 채움 */}
              <button
                type="button"
                style={styles.chatHeroCard}
                onClick={() => setScreen("chat")}
              >
                <img src={logoPath} alt="식물과 대화하기" style={styles.chatHeroIcon} />
                <div style={styles.chatHeroTextBox}>
                  <h2 style={styles.chatHeroTitle}>
                    {plantDisplayName}와 대화하기
                  </h2>
                  <p style={styles.chatHeroDesc}>
                    {plant ? "궁금한 거 뭐든지 물어봐!" : "등록하면 저랑 대화할 수 있어요!"}
                  </p>
                </div>
                <span style={styles.chatHeroArrow}>→</span>
              </button>

              {/* 관찰 버튼 3개 — 가로 나열 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
              }}>
                {[
                  {
                    icon: latestLeafRecord ? (latestLeafIcon || "/icons/leaf.png") : "/icons/leaf.png",
                    label: leafVisualState === "기록해요" ? "잎 관찰하기" : leafVisualState,
                    faded: !latestLeafRecord,
                    screen: "leafRecord",
                  },
                  {
                    icon: latestSoilRecord ? (latestSoilIcon || "/icons/soil.png") : "/icons/soil.png",
                    label: soilVisualState === "기록해요" ? "흙 관찰하기" : soilVisualState,
                    faded: !latestSoilRecord,
                    screen: "soilRecord",
                  },
                  {
                    icon: latestPhotoRecord ? latestPhotoIcon : "/icons/camera.png",
                    label: photoVisualState,
                    faded: !latestPhotoRecord,
                    screen: "photoRecord",
                  },
                ].map(({ icon, label, faded, screen: sc }) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setScreen(sc as typeof screen)}
                    style={{
                      border: "1px solid #E4DABF",
                      background: "#FFFDF6",
                      borderRadius: "16px",
                      padding: "14px 6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    <img
                      src={icon}
                      alt={label}
                      style={{
                        width: "36px",
                        height: "36px",
                        objectFit: "contain",
                        opacity: faded ? 0.3 : 1,
                      }}
                    />
                    <span style={{
                      fontSize: "13px",
                      fontWeight: 900,
                      color: "#2F4F2F",
                      textAlign: "center",
                    }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </main>
        </div>

        {renderBottomNav()}
        {renderWaterPrompt()}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    height: "100dvh",
    background: "#F8F5EA",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px",
    overflow: "hidden",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  landscapeFrame: {
    position: "relative",
    width: "100%",
    maxWidth: "1080px",
    height: "min(720px, calc(100dvh - 16px))",
    minHeight: 0,
    background: "#FFFDF6",
    borderRadius: "30px",
    boxShadow: "0 14px 34px rgba(75, 90, 65, 0.16)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  screenContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },

  startPanel: {
    flex: 1,
    padding: "26px 42px",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },

  startCompactHeader: {
    background: "#EEF5E7",
    border: "1px solid #DCE8CF",
    borderRadius: "24px",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: "18px",
    flexShrink: 0,
  },

  startMainImage: {
    width: "96px",
    height: "96px",
    objectFit: "contain",
  },

  startTitle: {
    margin: 0,
    fontSize: "34px",
    color: "#2F4F2F",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  startSubtitle: {
    margin: "6px 0 0",
    color: "#6B7F5A",
    fontSize: "21px",
    lineHeight: 1.35,
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  startChildGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "18px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },

  startChildButton: {
    border: "1px solid #DCE8CF",
    background: "#FFFFFF",
    color: "#2F4F2F",
    borderRadius: "18px",
    padding: "11px 8px",
    fontSize: "15px",
    fontWeight: 950,
    cursor: "pointer",
    wordBreak: "keep-all",
    minHeight: "72px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
  },

  startChildButtonActive: {
    border: "3px solid #E3BE3C",
    background: "#FFF1B8",
    color: "#2F4F2F",
    borderRadius: "18px",
    padding: "9px 6px",
    fontSize: "18px",
    fontWeight: 950,
    cursor: "pointer",
    wordBreak: "keep-all",
    minHeight: "72px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
  },

  startChildName: {
    color: "#2F4F2F",
    fontSize: "20px",
    fontWeight: 950,
    lineHeight: 1.1,
  },

  startChildMeta: {
    color: "#6B7F5A",
    fontSize: "12px",
    fontWeight: 850,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },

  childParticipationBarTrack: {
    width: "72%",
    height: "7px",
    borderRadius: "999px",
    background: "#E7F0DD",
    overflow: "hidden",
    display: "block",
  },

  childParticipationBarFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#5F8D4E",
    display: "block",
    transition: "width 180ms ease",
  },

  startHelperText: {
    margin: "26px 0 0",
    color: "#6B7F5A",
    fontSize: "18px",
    fontWeight: 850,
    wordBreak: "keep-all",
  },

  startActionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "16px",
    flexShrink: 0,
  },

  primaryButton: {
    width: "190px",
    border: "none",
    background: "#5F8D4E",
    color: "white",
    padding: "16px 34px",
    borderRadius: "999px",
    fontSize: "19px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.3)",
  },

  secondaryStartButton: {
    border: "1px solid #D8CFB8",
    background: "#FFFFFF",
    color: "#3F6B34",
    padding: "16px 24px",
    borderRadius: "999px",
    fontSize: "19px",
    fontWeight: 900,
    cursor: "pointer",
  },

  topBar: {
    height: "54px",
    borderBottom: "1px solid #ECE6D3",
    background: "#FFFDF6",
    padding: "0 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  topBarIcon: {
    width: "36px",
    height: "36px",
    objectFit: "contain",
    flexShrink: 0,
  },

  topBarTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "22px",
    fontWeight: 900,
  },

  topBarDesc: {
    margin: "3px 0 0",
    color: "#6B7F5A",
    fontSize: "12px",
    fontWeight: 700,
    wordBreak: "keep-all",
  },

  topBarActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },

  childNameBox: {
    position: "relative",
    border: "1px solid #D8CFB8",
    background: "#FFFFFF",
    color: "#4F6B3F",
    borderRadius: "999px",
    padding: "6px 10px",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "13px",
    fontWeight: 900,
  },

  childNameSelect: {
    width: "112px",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 900,
  },

  childSearchPopover: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: "250px",
    maxHeight: "172px",
    overflowY: "auto",
    background: "#FFFFFF",
    border: "1px solid #D8CFB8",
    borderRadius: "16px",
    boxShadow: "0 12px 24px rgba(75, 90, 65, 0.18)",
    padding: "8px",
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px",
  },

  childSearchOption: {
    border: "none",
    background: "#FFFDF6",
    color: "#2F4F2F",
    borderRadius: "12px",
    padding: "9px 10px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "center",
    minWidth: 0,
  },

  childAddButton: {
    border: "1px solid #C7DFC2",
    background: "#F2F7EA",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  installButton: {
    border: "1px solid #C7DFC2",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },

  settingsButton: {
    border: "1px solid #D8CFB8",
    background: "#FFFFFF",
    color: "#4F6B3F",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },

  settingsIcon: {
    width: "24px",
    height: "24px",
    objectFit: "contain",
  },

    apiKeyButton: {
      border: "1px solid #C7DFC2",
      background: "#F2F7EA",
      color: "#3F6B34",
      borderRadius: "999px",
      padding: "10px 14px",
      fontSize: "13px",
      fontWeight: 900,
      cursor: "pointer",
    },

    apiKeyModalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.24)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px",
    },

    apiKeyModalCard: {
      width: "min(520px, 100%)",
      background: "#FFFFFF",
      borderRadius: "24px",
      padding: "24px",
      boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    },

    apiKeyModalHeader: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px",
    },

    apiKeyModalTitle: {
      margin: 0,
      fontSize: "20px",
      fontWeight: 900,
      color: "#2F4F2F",
    },

    apiKeyModalDesc: {
      margin: "8px 0 0",
      color: "#5B4A21",
      fontSize: "14px",
      lineHeight: 1.5,
    },

    apiKeyModalCloseButton: {
      border: "none",
      background: "transparent",
      color: "#5B4A21",
      fontSize: "24px",
      fontWeight: 900,
      cursor: "pointer",
      lineHeight: 1,
    },

    apiKeyInput: {
      width: "100%",
      border: "1px solid #E8E1C8",
      borderRadius: "16px",
      padding: "14px 16px",
      fontSize: "15px",
      outline: "none",
      color: "#2F4F2F",
    },

    apiKeyErrorText: {
      margin: 0,
      color: "#8E2E1A",
      fontSize: "13px",
      minHeight: "20px",
    },

    apiKeyActions: {
      display: "flex",
      gap: "10px",
      justifyContent: "flex-end",
      flexWrap: "wrap",
    },

    apiKeyRemoveButton: {
      border: "1px solid #E9C879",
      background: "#FFF1D6",
      color: "#8E5B2F",
      borderRadius: "999px",
      padding: "10px 16px",
      fontSize: "14px",
      fontWeight: 900,
      cursor: "pointer",
    },

  homeLayout: {
    display: "grid",
    gridTemplateColumns: "1fr 0.95fr",
    gap: "8px",
    minHeight: 0,
    overflowY: "auto",
    alignItems: "stretch",
  },

  homeLeftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    minHeight: 0,
    overflowY: "auto",
  },

  homeRightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minHeight: 0,
    overflowY: "auto",
  },

  chatHeroCardLarge: {
    flex: 1,
  },

  dateCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "16px",
    padding: "8px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.05)",
  },

  dateLabel: {
    margin: 0,
    color: "#5F704B",
    fontSize: "11px",
    fontWeight: 900,
  },

  dateText: {
    margin: "2px 0 0",
    color: "#2F4F2F",
    fontSize: "16px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  dateIcon: {
    width: "42px",
    height: "42px",
    objectFit: "contain",
    flexShrink: 0,
  },

  homeChildPickerCard: {
    background: "#FFFDF6",
    border: "1px solid #E8E1C8",
    borderRadius: "20px",
    padding: "12px 14px",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.05)",
  },

  homeChildButtonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    maxHeight: "82px",
    overflowY: "auto",
    marginTop: "8px",
    paddingRight: "4px",
  },

  homeChildButton: {
    border: "1px solid #DCE8CF",
    background: "#FFFFFF",
    color: "#2F4F2F",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  homeChildButtonActive: {
    border: "2px solid #E3BE3C",
    background: "#FFF1B8",
    color: "#2F4F2F",
    borderRadius: "999px",
    padding: "7px 13px",
    fontSize: "15px",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  myPlantCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "18px",
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
  },

  myPlantTextBox: {
    flex: 1,
  },

  myPlantTopLine: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "5px",
  },

  sectionLabel: {
    margin: 0,
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 900,
  },

  editPlantButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  myPlantName: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "22px",
    fontWeight: 900,
  },

  myPlantType: {
    margin: "4px 0 0",
    color: "#4F6B3F",
    fontSize: "14px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  myPlantDesc: {
    margin: "4px 0 0",
    color: "#6B7F5A",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },

  myPlantImageButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  },

  myPlantImage: {
    width: "100px",
    height: "100px",
    objectFit: "contain",
  },

  myPlantListenHint: {
    color: "#5F704B",
    background: "#E7F0DD",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  todayCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "18px",
    padding: "10px 12px",
  },

  homeWaterAlert: {
    marginTop: "8px",
    background: "#FFF0C6",
    border: "2px solid #E5B84B",
    borderRadius: "18px",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  homeWaterReady: {
    marginTop: "8px",
    background: "#F2F7EA",
    border: "1px solid #DCE8CF",
    borderRadius: "18px",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  homeWaterCounterAlert: {
    marginTop: "6px",
    background: "#FFF0C6",
    border: "2px solid #E5B84B",
    borderRadius: "16px",
    padding: "8px 10px",
    display: "grid",
    gridTemplateColumns: "64px 1fr auto",
    gap: "8px",
    alignItems: "center",
  },

  homeWaterCounterReady: {
    marginTop: "6px",
    background: "#F2F7EA",
    border: "1px solid #DCE8CF",
    borderRadius: "16px",
    padding: "8px 10px",
    display: "grid",
    gridTemplateColumns: "64px 1fr auto",
    gap: "8px",
    alignItems: "center",
  },

  homeWaterMiniStage: {
    position: "relative",
    width: "64px",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "18px",
    background: "rgba(255, 253, 246, 0.78)",
  },

  homeWaterPlantIcon: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    position: "relative",
    zIndex: 1,
    marginBottom: "0px",
  },

  homeWaterDropIcon: {
    width: "20px",
    height: "20px",
    objectFit: "contain",
    position: "absolute",
    top: "-8px",
    right: "-6px",
    zIndex: 2,
  },

  homeWaterCounterTextBox: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: 0,
  },

  homeWaterCounterTitle: {
    color: "#2F4F2F",
    fontSize: "15px",
    fontWeight: 950,
    lineHeight: 1.1,
  },

  homeWaterCounterCount: {
    color: "#757064",
    fontSize: "15px",
    fontWeight: 950,
    lineHeight: 1.15,
  },

  homeWaterLabel: {
    color: "#5F704B",
    fontSize: "13px",
    fontWeight: 900,
  },

  homeWaterSpeech: {
    gridColumn: "1 / -1",
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },

  homeWaterActionButton: {
    gridColumn: "3",
    gridRow: "1 / span 2",
    alignSelf: "center",
    border: "none",
    background: "#5F914C",
    color: "#FFFFFF",
    borderRadius: "999px",
    padding: "13px 18px",
    fontSize: "15px",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 145, 76, 0.18)",
    whiteSpace: "nowrap",
  },

  homeWaterActionButtonDisabled: {
    gridColumn: "3",
    gridRow: "1 / span 2",
    alignSelf: "center",
    border: "1px solid #DCE8CF",
    background: "#FFFFFF",
    color: "#6B7F5A",
    borderRadius: "999px",
    padding: "13px 18px",
    fontSize: "15px",
    fontWeight: 950,
    cursor: "default",
    whiteSpace: "nowrap",
  },

  homePhotoCard: {
    marginTop: "10px",
    width: "100%",
    border: "1px solid #E4DABF",
    background: "#FFFFFF",
    borderRadius: "18px",
    padding: "10px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    cursor: "pointer",
    textAlign: "left",
  },

  homePhotoImage: {
    width: "104px",
    height: "72px",
    objectFit: "contain",
    borderRadius: "16px",
    border: "1px solid #E8E1C8",
    background: "#FFFDF6",
    flexShrink: 0,
  },

  homePhotoTextBox: {
    color: "#2F4F2F",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    fontSize: "16px",
    fontWeight: 900,
  },

  homePhotoEmpty: {
    marginTop: "8px",
    width: "100%",
    border: "1px dashed #D8CFB8",
    background: "#FFFDF6",
    color: "#4F6B3F",
    borderRadius: "16px",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  homePhotoIcon: {
    width: "24px",
    height: "24px",
    objectFit: "contain",
  },

  visualSummaryCard: {
    marginTop: "6px",
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "14px",
    padding: "7px 8px",
  },

  visualSummaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },

  visualSummaryLabel: {
    color: "#6B7F5A",
    fontSize: "13px",
    fontWeight: 900,
  },

  visualSummarySpeech: {
    color: "#2F4F2F",
    fontSize: "15px",
    fontWeight: 950,
    wordBreak: "keep-all",
  },

  visualSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },

  visualSummaryItem: {
    border: "1px solid #E4DABF",
    background: "#FFFDF6",
    borderRadius: "12px",
    minHeight: "56px",
    padding: "6px 4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    cursor: "pointer",
  },

  visualSummaryIcon: {
    width: "34px",
    height: "34px",
    objectFit: "contain",
  },

  visualSummaryPlaceholder: {
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    border: "2px dashed #D8CFB8",
    background: "#FFFDF6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  visualSummaryPlaceholderIcon: {
    width: "26px",
    height: "26px",
    objectFit: "contain",
    opacity: 0.24,
  },

  visualSummaryText: {
    color: "#2F4F2F",
    fontSize: "13px",
    fontWeight: 950,
    lineHeight: 1.2,
    textAlign: "center",
    wordBreak: "keep-all",
  },

  todayButtonRow: {
    marginTop: "10px",
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "8px",
  },

  todayButton: {
    border: "1px solid #E4DABF",
    background: "#FFFDF6",
    color: "#2F4F2F",
    borderRadius: "15px",
    padding: "9px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  todayIcon: {
    width: "34px",
    height: "34px",
    objectFit: "contain",
  },

  chatHeroCard: {
    width: "100%",
    flex: 1,
    background: "linear-gradient(135deg, #5FA34E 0%, #3D6B34 100%)",
    border: "2px solid rgba(255,255,255,0.15)",
    borderRadius: "22px",
    padding: "16px 18px",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    textAlign: "left",
    boxShadow: "0 8px 20px rgba(60, 100, 50, 0.35)",
  },

  chatHeroIcon: {
    width: "76px",
    height: "76px",
    objectFit: "contain",
    flexShrink: 0,
  },

  chatHeroTextBox: {
    flex: 1,
  },

  chatHeroTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  chatHeroDesc: {
    margin: "6px 0 0",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.45,
    opacity: 0.95,
    wordBreak: "keep-all",
  },

  chatHeroArrow: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.24)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "24px",
    fontWeight: 900,
    flexShrink: 0,
  },

  registerLayout: {
    flex: 1,
    padding: "18px 24px",
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "24px",
    minHeight: 0,
    overflowY: "auto",
  },

  registerPreviewCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "28px",
    padding: "28px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  registerPreviewImage: {
    width: "150px",
    height: "150px",
    objectFit: "contain",
    marginBottom: "18px",
  },

  registerPreviewTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "30px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  registerPreviewText: {
    margin: "10px 0 0",
    color: "#4F6B3F",
    fontSize: "15px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  registerPreviewMemo: {
    margin: "12px 0 0",
    color: "#6B7F5A",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  registerFormCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "28px",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    minHeight: 0,
    overflowY: "auto",
  },

  formLabel: {
    color: "#2F4F2F",
    fontSize: "17px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  formInput: {
    border: "1px solid #D8CFB8",
    borderRadius: "18px",
    padding: "15px 16px",
    fontSize: "17px",
    color: "#2F4F2F",
    outline: "none",
    background: "#FFFDF6",
    fontWeight: 700,
  },

  formTextarea: {
    border: "1px solid #D8CFB8",
    borderRadius: "18px",
    padding: "15px 16px",
    fontSize: "17px",
    color: "#2F4F2F",
    outline: "none",
    background: "#FFFDF6",
    minHeight: "110px",
    resize: "none",
    fontWeight: 700,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  teacherQuickBox: {
    border: "1px solid #DCE8CF",
    borderRadius: "20px",
    background: "#F2F7EA",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
  },

  teacherQuickTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "16px",
    fontWeight: 900,
  },

  teacherQuickText: {
    margin: "5px 0 0",
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },

  draftStatusIdle: {
    border: "1px solid #E4DABF",
    borderRadius: "16px",
    background: "#FFFDF6",
    color: "#5F704B",
    padding: "11px 13px",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.4,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    wordBreak: "keep-all",
  },

  draftStatusLoading: {
    border: "1px solid #C9DCEB",
    borderRadius: "16px",
    background: "#F0F8FF",
    color: "#3B617E",
    padding: "11px 13px",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.4,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    wordBreak: "keep-all",
  },

  draftStatusSuccess: {
    border: "1px solid #C7DFC2",
    borderRadius: "16px",
    background: "#F2F7EA",
    color: "#3F6B34",
    padding: "11px 13px",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.4,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    wordBreak: "keep-all",
  },

  draftStatusWarning: {
    border: "1px solid #E5C66D",
    borderRadius: "16px",
    background: "#FFF7D8",
    color: "#73571F",
    padding: "11px 13px",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.4,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    wordBreak: "keep-all",
  },

  draftStatusError: {
    border: "1px solid #E9B6A8",
    borderRadius: "16px",
    background: "#FFF0EA",
    color: "#8A3B27",
    padding: "11px 13px",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.4,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    wordBreak: "keep-all",
  },

  draftStatusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "currentColor",
    flex: "0 0 auto",
  },

  teacherInfoBox: {
    border: "1px solid #E4DABF",
    borderRadius: "22px",
    background: "#FFFDF6",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  teacherInfoHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
  },

  teacherInfoTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "19px",
    fontWeight: 900,
  },

  teacherInfoDesc: {
    margin: "6px 0 0",
    color: "#6B7F5A",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  draftButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "11px 16px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    opacity: 1,
  },

  teacherTextarea: {
    border: "1px solid #D8CFB8",
    borderRadius: "16px",
    padding: "11px 13px",
    fontSize: "13px",
    color: "#2F4F2F",
    outline: "none",
    background: "#FFFFFF",
    minHeight: "62px",
    resize: "none",
    fontWeight: 700,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  registerButtonRow: {
    marginTop: "auto",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },

  deleteButton: {
    border: "none",
    background: "#F4E0D8",
    color: "#9A4634",
    borderRadius: "999px",
    padding: "11px 20px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
  },

  saveButton: {
    border: "none",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "11px 22px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.24)",
  },

  tabMainLayout: {
    flex: 1,
    padding: "10px 16px",
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "14px",
    minHeight: 0,
  },

  sideInfoCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "22px",
    padding: "12px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },

  sideInfoIcon: {
    width: "56px",
    height: "56px",
    objectFit: "contain",
    marginBottom: "10px",
  },

  sideInfoTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "18px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  sideInfoText: {
    margin: "8px 0 0",
    color: "#6B7F5A",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.5,
    wordBreak: "keep-all",
  },

  careSpeechText: {
    margin: "10px 0 0",
    color: "#6B7F5A",
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },

  careSimpleCheck: {
    width: "100%",
    marginTop: "10px",
    background: "#FFF8D9",
    border: "1px solid #E5C66D",
    borderRadius: "18px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  careSimpleCheckLabel: {
    color: "#6B7F5A",
    fontSize: "13px",
    fontWeight: 900,
  },

  careSimpleCheckText: {
    color: "#2F4F2F",
    fontSize: "18px",
    fontWeight: 950,
    lineHeight: 1.3,
    wordBreak: "keep-all",
  },

  primarySideButton: {
    border: "none",
    background: "#5F8D4E",
    color: "#FFFFFF",
    borderRadius: "999px",
    padding: "12px 18px",
    marginTop: "18px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 14px rgba(95, 141, 78, 0.22)",
  },

  horizontalCardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },

  largeFeatureCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "20px",
    padding: "16px 12px",
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.06)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  featureIcon: {
    width: "64px",
    height: "64px",
    objectFit: "contain",
    marginBottom: "10px",
  },

  featureTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "17px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  featureDesc: {
    margin: "6px 0 0",
    color: "#7B7B67",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  observationLayout: {
    flex: 1,
    padding: "8px 14px",
    display: "grid",
    gridTemplateColumns: "190px 1fr",
    gap: "12px",
    minHeight: 0,
    overflowY: "auto",
  },

  photoRecordLayout: {
    flex: 1,
    padding: "10px 16px",
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "12px",
    minHeight: 0,
    overflowY: "auto",
  },

  observationSideCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "22px",
    padding: "14px 12px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },

  photoUploadCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "22px",
    padding: "14px 12px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minHeight: 0,
  },

  observationSideIcon: {
    width: "68px",
    height: "68px",
    objectFit: "contain",
    marginBottom: "10px",
  },

  observationSideTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "19px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  observationSideText: {
    margin: "6px 0 0",
    color: "#6B7F5A",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  photoActionRow: {
    width: "100%",
    marginTop: "16px",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },

  photoCaptureButton: {
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "13px 18px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.22)",
    wordBreak: "keep-all",
  },

  photoAlbumButton: {
    background: "#FFFFFF",
    color: "#3F6B34",
    border: "1px solid #D8CFB8",
    borderRadius: "999px",
    padding: "12px 18px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  hiddenFileInput: {
    display: "none",
  },

  photoPreviewBox: {
    marginTop: "16px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },

  photoPreviewImage: {
    width: "100%",
    maxHeight: "180px",
    objectFit: "contain",
    borderRadius: "20px",
    border: "2px solid #D8CFB8",
    background: "#FFFDF6",
  },

  emptyPhotoBox: {
    marginTop: "16px",
    width: "100%",
    minHeight: "140px",
    border: "2px dashed #D8CFB8",
    borderRadius: "20px",
    color: "#7B7B67",
    fontSize: "15px",
    fontWeight: 800,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#FFFDF6",
  },

  removePhotoButton: {
    border: "none",
    background: "#F4E0D8",
    color: "#9A4634",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  observationFormCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "16px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minHeight: 0,
  },

  questionTitle: {
    margin: "0 0 6px",
    color: "#2F4F2F",
    fontSize: "15px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  choiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
  },

  choiceCard: {
    borderRadius: "16px",
    padding: "7px 5px",
    minHeight: "86px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    gap: "6px",
  },

  choiceIcon: {
    width: "42px",
    height: "42px",
    objectFit: "contain",
  },

  choiceLabel: {
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  memoLabel: {
    color: "#5F704B",
    fontSize: "15px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  memoTextarea: {
    border: "1px solid #D8CFB8",
    borderRadius: "16px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#2F4F2F",
    outline: "none",
    background: "#FFFDF6",
    minHeight: "48px",
    resize: "none",
    fontWeight: 700,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  observationNotice: {
    background: "#FFF1D6",
    border: "2px solid #E9C879",
    color: "#5B4A21",
    borderRadius: "16px",
    padding: "10px 14px",
    fontSize: "15px",
    fontWeight: 900,
    textAlign: "center",
    wordBreak: "keep-all",
  },

  recordLayout: {
    flex: 1,
    padding: "10px 16px",
    display: "grid",
    gridTemplateColumns: "210px 1fr",
    gap: "12px",
    minHeight: 0,
    overflow: "hidden",
  },

  recordListPanel: {
    minHeight: 0,
    overflowY: "auto",
    paddingRight: "4px",
    paddingBottom: "12px",
  },

  recordDateFilterBox: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "16px",
    padding: "10px",
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: "8px",
    alignItems: "center",
    marginBottom: "8px",
  },

  recordSummaryTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginBottom: "10px",
  },

  recordSummaryTab: {
    border: "1px solid #E4DABF",
    background: "#FFFFFF",
    color: "#42553A",
    borderRadius: "999px",
    padding: "8px 8px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  recordSummaryTabActive: {
    border: "2px solid #E3BE3C",
    background: "#FFF4B8",
    color: "#2F4F2F",
    borderRadius: "999px",
    padding: "7px 8px",
    fontSize: "12px",
    fontWeight: 950,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  recordSaveNotice: {
    background: "#E7F0DD",
    border: "2px solid #BBD2AA",
    borderRadius: "22px",
    padding: "14px 16px",
    marginBottom: "16px",
    color: "#2F4F2F",
    fontSize: "18px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    wordBreak: "keep-all",
  },

  recordSaveIcon: {
    background: "#5F8D4E",
    color: "#FFFFFF",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "14px",
    fontWeight: 900,
    flex: "0 0 auto",
  },

  photoAnalysisNotice: {
    background: "#F2F7EA",
    border: "1px solid #C7DFC2",
    borderRadius: "18px",
    padding: "12px 14px",
    marginBottom: "16px",
    color: "#3F6B34",
    fontSize: "15px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  analysisTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
    marginBottom: "10px",
  },

  analysisTab: {
    border: "1px solid #E4DABF",
    background: "#FFFFFF",
    color: "#42553A",
    borderRadius: "999px",
    padding: "8px 8px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  analysisTabActive: {
    border: "2px solid #E3BE3C",
    background: "#FFF4B8",
    color: "#2F4F2F",
    borderRadius: "999px",
    padding: "7px 8px",
    fontSize: "13px",
    fontWeight: 950,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  analysisRosterBox: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "14px",
    padding: "9px",
    marginBottom: "10px",
  },

  analysisChildSearchInput: {
    width: "100%",
    border: "1px solid #D8CFB8",
    background: "#FFFDF6",
    color: "#2F4F2F",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "15px",
    fontWeight: 900,
    outline: "none",
    marginTop: "10px",
  },

  analysisChildChipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    maxHeight: "92px",
    overflowY: "auto",
    marginTop: "10px",
    paddingRight: "4px",
  },

  analysisChildChip: {
    border: "1px solid #DCE8CF",
    background: "#FFFFFF",
    color: "#2F4F2F",
    borderRadius: "18px",
    padding: "9px 13px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    minWidth: "108px",
    whiteSpace: "nowrap",
  },

  analysisChildChipActive: {
    border: "2px solid #E3BE3C",
    background: "#FFF1B8",
    color: "#2F4F2F",
    borderRadius: "18px",
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    minWidth: "108px",
    whiteSpace: "nowrap",
  },

  analysisChildChipName: {
    color: "#2F4F2F",
    fontSize: "16px",
    fontWeight: 950,
    lineHeight: 1.15,
  },

  analysisChildChipMeta: {
    color: "#6B7F5A",
    fontSize: "12px",
    fontWeight: 850,
    lineHeight: 1.2,
  },

  analysisChildNoResult: {
    color: "#7B7B67",
    fontSize: "14px",
    fontWeight: 850,
    padding: "8px 4px",
  },

  participationBox: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "24px",
    padding: "16px",
    marginBottom: "16px",
  },

  participationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
  },

  participationGroupStack: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },

  participationGroup: {
    background: "#FFFDF6",
    border: "1px solid #E8E1C8",
    borderRadius: "16px",
    padding: "10px 12px",
  },

  participationGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 900,
    marginBottom: "8px",
  },

  participationChipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
  },

  participationChip: {
    border: "1px solid #DCE8CF",
    background: "#FFFFFF",
    color: "#2F4F2F",
    borderRadius: "999px",
    padding: "7px 10px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  participationChipActive: {
    border: "2px solid #E3BE3C",
    background: "#FFF1B8",
    color: "#2F4F2F",
    borderRadius: "999px",
    padding: "6px 9px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  participationEmptyLine: {
    margin: 0,
    color: "#7B7B67",
    fontSize: "13px",
    fontWeight: 850,
  },

  participationItem: {
    border: "1px solid #E4DABF",
    background: "#FFFDF6",
    color: "#2F4F2F",
    borderRadius: "16px",
    padding: "10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 900,
    minHeight: "62px",
    wordBreak: "keep-all",
  },

  participationItemActive: {
    border: "2px solid #E3BE3C",
    background: "#FFF1B8",
    color: "#2F4F2F",
    borderRadius: "16px",
    padding: "9px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 900,
    minHeight: "62px",
    wordBreak: "keep-all",
  },

  participationMeta: {
    color: "#6B7F5A",
    fontSize: "11px",
    fontWeight: 850,
    lineHeight: 1.25,
    wordBreak: "keep-all",
  },

  selectedParticipationBox: {
    marginTop: "12px",
    background: "#F2F7EA",
    border: "1px solid #C7DFC2",
    borderRadius: "16px",
    padding: "11px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 850,
    wordBreak: "keep-all",
  },

  participationHint: {
    margin: "12px 0 0",
    background: "#FFF7D8",
    border: "1px solid #E5C66D",
    borderRadius: "14px",
    padding: "10px 12px",
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 850,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  curriculumReportBox: {
    background: "#FFF8D8",
    border: "2px solid #E3BE3C",
    borderRadius: "24px",
    padding: "16px",
    marginBottom: "16px",
  },

  curriculumReportHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },

  curriculumReportGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
  },

  curriculumAreaCard: {
    background: "#FFFFFF",
    border: "1px solid #E4DABF",
    borderRadius: "20px",
    padding: "12px",
  },

  curriculumAreaTitle: {
    margin: "0 0 8px",
    color: "#2F4F2F",
    fontSize: "19px",
    fontWeight: 900,
  },

  curriculumItem: {
    background: "#FFFDF6",
    border: "1px solid #EFE7D2",
    borderRadius: "16px",
    padding: "11px 12px",
    marginBottom: "8px",
    display: "grid",
    gridTemplateColumns: "170px 1fr",
    gap: "12px",
    alignItems: "start",
    color: "#42553A",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  curriculumItemTitle: {
    color: "#2F4F2F",
    fontSize: "15px",
    fontWeight: 950,
    lineHeight: 1.35,
  },

  curriculumItemText: {
    margin: 0,
    color: "#42553A",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  curriculumEmpty: {
    background: "#FFFDF6",
    border: "1px dashed #D8CFB8",
    borderRadius: "18px",
    padding: "18px",
    color: "#5F704B",
    fontSize: "16px",
    fontWeight: 900,
    lineHeight: 1.5,
    textAlign: "center",
    wordBreak: "keep-all",
  },

  photoCompareBox: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "24px",
    padding: "16px",
    marginBottom: "16px",
  },

  weeklySummaryBox: {
    background: "#F2F7EA",
    border: "1px solid #C7DFC2",
    borderRadius: "24px",
    padding: "16px",
    marginBottom: "16px",
  },

  weeklySummaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },

  weeklyMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },

  weeklyMetricCard: {
    background: "#FFFFFF",
    border: "1px solid #DCE8CF",
    borderRadius: "16px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    color: "#2F4F2F",
    fontWeight: 900,
  },

  weeklySummaryText: {
    margin: "0 0 10px",
    color: "#42553A",
    fontSize: "15px",
    fontWeight: 850,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  weeklyFocusList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
  },

  weeklyFocusItem: {
    background: "#FFFFFF",
    border: "1px solid #DCE8CF",
    borderRadius: "14px",
    padding: "9px 11px",
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 850,
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },

  photoCompareHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },

  photoCompareGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },

  photoCompareItem: {
    background: "#FFFDF6",
    border: "1px solid #E4DABF",
    borderRadius: "18px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  photoCompareLabel: {
    color: "#6B7F5A",
    fontSize: "13px",
    fontWeight: 900,
  },

  photoCompareImage: {
    width: "100%",
    height: "160px",
    objectFit: "contain",
    borderRadius: "14px",
    border: "1px solid #E8E1C8",
    background: "#FFFDF6",
  },

  photoCompareCaption: {
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  photoCompareEmpty: {
    minHeight: "160px",
    border: "2px dashed #D8CFB8",
    background: "#FFFDF6",
    color: "#5F704B",
    borderRadius: "16px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  attentionBox: {
    background: "#FFF7D8",
    border: "2px solid #E5C66D",
    borderRadius: "24px",
    padding: "16px",
    marginBottom: "16px",
  },

  attentionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },

  attentionLabel: {
    margin: 0,
    color: "#73571F",
    fontSize: "14px",
    fontWeight: 900,
  },

  attentionTitle: {
    margin: "4px 0 0",
    color: "#2F4F2F",
    fontSize: "23px",
    fontWeight: 950,
  },

  attentionCount: {
    background: "#FFFFFF",
    color: "#73571F",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "14px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  attentionEmpty: {
    background: "#FFFFFF",
    borderRadius: "18px",
    padding: "15px",
    color: "#5F704B",
    fontSize: "15px",
    fontWeight: 800,
    textAlign: "center",
  },

  attentionList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },

  attentionItem: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "14px",
    padding: "9px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  attentionIcon: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    flex: "0 0 auto",
  },

  attentionTextBox: {
    minWidth: 0,
  },

  attentionDate: {
    margin: 0,
    color: "#7B7B67",
    fontSize: "13px",
    fontWeight: 800,
  },

  attentionReason: {
    display: "block",
    marginTop: "3px",
    color: "#2F4F2F",
    fontSize: "17px",
    fontWeight: 950,
    wordBreak: "keep-all",
  },

  attentionAction: {
    margin: "5px 0 0",
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },

  attentionActionRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
  },

  attentionStatusPill: {
    background: "#FFF1D6",
    color: "#8A5C1D",
    borderRadius: "999px",
    padding: "6px 9px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  attentionFollowButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  recordDateInput: {
    border: "1px solid #D8CFB8",
    borderRadius: "14px",
    padding: "11px 12px",
    color: "#2F4F2F",
    background: "#FFFDF6",
    fontSize: "15px",
    fontWeight: 800,
  },

  recordDateFilterButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "11px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  todayRecordHeader: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "24px",
    padding: "18px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },

  todayRecordLabel: {
    margin: 0,
    color: "#5F704B",
    fontSize: "16px",
    fontWeight: 900,
  },

  todayRecordDate: {
    margin: "4px 0 0",
    color: "#2F4F2F",
    fontSize: "25px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  todayRecordCount: {
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "15px",
    fontWeight: 900,
  },

  recordCategoryStack: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  recordGroupBox: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "24px",
    padding: "16px",
  },

  recordGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },

  recordGroupTitleBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  recordGroupIcon: {
    width: "38px",
    height: "38px",
    objectFit: "contain",
  },

  recordGroupTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "21px",
    fontWeight: 900,
  },

  recordGroupCount: {
    background: "#F2F7EA",
    color: "#4F6B3F",
    borderRadius: "999px",
    padding: "6px 11px",
    fontSize: "13px",
    fontWeight: 900,
  },

  recordGroupEmpty: {
    background: "#FFFDF6",
    border: "1px dashed #D8CFB8",
    borderRadius: "18px",
    padding: "18px",
    color: "#7B7B67",
    fontSize: "15px",
    fontWeight: 800,
    textAlign: "center",
  },

  recordGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },

  recordCard: {
    background: "#FFFDF6",
    border: "1px solid #E8E1C8",
    borderRadius: "22px",
    padding: "16px",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.05)",
  },

  recordPhoto: {
    width: "100%",
    height: "150px",
    objectFit: "contain",
    borderRadius: "18px",
    marginBottom: "14px",
    border: "1px solid #E8E1C8",
    background: "#FFFDF6",
  },

  recordCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },

  recordDate: {
    margin: 0,
    color: "#7B7B67",
    fontSize: "13px",
    fontWeight: 800,
  },

  recordChildName: {
    margin: "3px 0 0",
    color: "#3F6B34",
    fontSize: "13px",
    fontWeight: 900,
  },

  recordTitle: {
    margin: "4px 0 0",
    color: "#2F4F2F",
    fontSize: "20px",
    fontWeight: 900,
  },

  recordDeleteButton: {
    border: "none",
    background: "#F4E0D8",
    color: "#9A4634",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },

  recordChoiceRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },

  recordChoiceBox: {
    background: "#FFFFFF",
    borderRadius: "18px",
    padding: "12px 8px",
    textAlign: "center",
    border: "1px solid #EFE7D2",
  },

  recordChoiceIcon: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    marginBottom: "6px",
  },

  recordChoiceLabel: {
    margin: 0,
    color: "#7B7B67",
    fontSize: "12px",
    fontWeight: 800,
  },

  recordChoiceText: {
    display: "block",
    marginTop: "3px",
    color: "#2F4F2F",
    fontSize: "15px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  recordMemo: {
    margin: "12px 0 0",
    background: "#FFFFFF",
    border: "1px solid #EFE7D2",
    borderRadius: "16px",
    padding: "10px 12px",
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  photoChildSummaryBox: {
    marginTop: "12px",
    background: "#FFF7D8",
    border: "1px solid #E5C66D",
    borderRadius: "16px",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  photoChildSummaryLabel: {
    color: "#8A6A18",
    fontSize: "12px",
    fontWeight: 900,
  },

  photoChildReadButton: {
    alignSelf: "flex-start",
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  photoAiBox: {
    marginTop: "12px",
    background: "#F2F7EA",
    border: "1px solid #DCE8CF",
    borderRadius: "16px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  photoAiLabel: {
    margin: 0,
    color: "#3F6B34",
    fontSize: "13px",
    fontWeight: 900,
  },

  photoAiText: {
    margin: "4px 0 0",
    color: "#5F704B",
    fontSize: "13px",
    fontWeight: 800,
    wordBreak: "keep-all",
  },

  photoAiButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  photoAnalysisResult: {
    background: "#FFFFFF",
    border: "1px solid #E4DABF",
    borderRadius: "14px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "9px",
    color: "#2F4F2F",
    fontSize: "13px",
    fontWeight: 800,
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },

  photoAnalysisBadge: {
    alignSelf: "flex-start",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },

  photoAnalysisBadgeWarning: {
    alignSelf: "flex-start",
    background: "#FFF1D6",
    color: "#8A5C1D",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },

  photoAnalysisLine: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },

  photoAnalysisAction: {
    background: "#FFF7D8",
    border: "1px solid #E5C66D",
    borderRadius: "12px",
    padding: "8px 10px",
    color: "#5B4A21",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    fontStyle: "normal",
    fontWeight: 900,
  },

  careLayout: {
    flex: 1,
    padding: "10px 16px",
    display: "grid",
    gridTemplateColumns: "210px 1fr",
    gap: "10px",
    minHeight: 0,
    overflowY: "auto",
  },

  resetButton: {
    marginTop: "12px",
    border: "none",
    background: "#FFFFFF",
    color: "#4F6B3F",
    borderRadius: "999px",
    padding: "8px 13px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.06)",
  },

  waterReminderBox: {
    width: "100%",
    marginTop: "12px",
    background: "#FFFDF6",
    border: "1px solid #E4DABF",
    borderRadius: "18px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },

  waterReminderLabel: {
    color: "#6B7F5A",
    fontSize: "13px",
    fontWeight: 900,
  },

  waterReminderText: {
    color: "#2F4F2F",
    fontSize: "17px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  careCardRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    minHeight: 0,
  },

  careCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "20px",
    padding: "12px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  careMotionStage: {
    position: "relative",
    width: "110px",
    height: "68px",
    marginBottom: "2px",
  },

  careMotionPlant: {
    position: "absolute",
    left: "40%",
    bottom: "0",
    width: "44px",
    height: "44px",
    objectFit: "contain",
    transform: "translateX(-50%)",
  },

  careMotionTool: {
    position: "absolute",
    right: "0",
    top: "2px",
    width: "42px",
    height: "42px",
    objectFit: "contain",
    transformOrigin: "18% 82%",
    zIndex: 2,
  },

  careMotionSun: {
    position: "absolute",
    left: "68%",
    top: "0",
    width: "48px",
    height: "48px",
    objectFit: "contain",
    transform: "translateX(-50%)",
  },

  waterDrop: {
    position: "absolute",
    top: "30px",
    width: "12px",
    height: "18px",
    borderRadius: "999px 999px 999px 0",
    background: "#8EC9E8",
    transform: "rotate(-45deg)",
    opacity: 0,
    zIndex: 1,
  },

  careIcon: {
    width: "82px",
    height: "82px",
    objectFit: "contain",
    marginBottom: "10px",
  },

  careTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "17px",
    fontWeight: 900,
  },

  statusText: {
    margin: "2px 0",
    color: "#7B7B67",
    fontSize: "15px",
    fontWeight: 900,
  },

  doneStatusText: {
    margin: "2px 0",
    color: "#4F8A3C",
    fontSize: "15px",
    fontWeight: 900,
  },

  goalControl: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "4px",
  },

  goalButton: {
    width: "30px",
    height: "30px",
    border: "none",
    borderRadius: "50%",
    background: "#E7F0DD",
    color: "#3F6B34",
    fontSize: "18px",
    fontWeight: 900,
    cursor: "pointer",
  },

  goalText: {
    color: "#4F6B3F",
    fontSize: "14px",
    fontWeight: 900,
    minWidth: "80px",
  },

  countButton: {
    border: "none",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(95, 141, 78, 0.24)",
  },

  countButtonDone: {
    border: "none",
    background: "#8DBE7A",
    color: "white",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.24)",
  },

  chatTopBar: {
    height: "68px",
    borderBottom: "1px solid #ECE6D3",
    background: "#FFFDF6",
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  backButton: {
    border: "none",
    background: "#F1EBD8",
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "21px",
    color: "#4B5F3C",
    flexShrink: 0,
  },

  chatLayout: {
    flex: 1,
    padding: "10px 16px",
    display: "grid",
    gridTemplateColumns: "190px 1fr",
    gap: "12px",
    minHeight: 0,
    overflow: "hidden",
  },

  chatPlantPanel: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "22px",
    padding: "14px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  chatPlantImage: {
    width: "104px",
    height: "104px",
    objectFit: "contain",
    marginBottom: "10px",
  },

  chatPlantName: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "20px",
    fontWeight: 900,
  },

  chatPlantDesc: {
    margin: "6px 0 0",
    color: "#6B7F5A",
    fontSize: "13px",
    fontWeight: 700,
    wordBreak: "keep-all",
  },

  chatMainPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minHeight: 0,
    overflow: "hidden",
  },

  chatMessageList: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: "8px",
    paddingRight: 0,
  },

  chatScrollAnchor: {
    width: "100%",
    height: "1px",
    flex: "0 0 auto",
  },

  speechBubble: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    padding: "16px 18px",
    borderRadius: "20px",
    color: "#42553A",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.55,
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.06)",
    wordBreak: "keep-all",
  },

  chatTurn: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  chatHistoryNotice: {
    alignSelf: "center",
    background: "#F3EEDC",
    color: "#6B7F5A",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 900,
    lineHeight: 1.2,
  },

  chatBubbleLabel: {
    display: "block",
    marginBottom: "3px",
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: "11px",
    fontWeight: 900,
    lineHeight: 1.1,
  },

  questionBubble: {
    alignSelf: "flex-end",
    maxWidth: "78%",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "18px 18px 6px 18px",
    padding: "9px 13px",
    fontSize: "13px",
    fontWeight: 800,
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },

  chatChildName: {
    display: "block",
    marginBottom: "4px",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "12px",
    fontWeight: 900,
  },

  answerBubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    color: "#42553A",
    borderRadius: "18px 18px 18px 6px",
    padding: "10px 13px",
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.4,
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.06)",
    wordBreak: "keep-all",
  },

  answerActions: {
    display: "flex",
    justifyContent: "flex-start",
  },

  readButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "7px 11px",
    marginTop: "8px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    alignSelf: "flex-start",
  },

  answerTestLayout: {
    padding: "26px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    minHeight: 0,
    overflowY: "auto",
  },

  answerTestIntro: {
    background: "#FFFDF6",
    border: "1px solid #E4DABF",
    borderRadius: "22px",
    padding: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
  },

  answerTestTitle: {
    margin: "6px 0",
    color: "#2F4F2F",
    fontSize: "28px",
    fontWeight: 950,
  },

  answerTestDesc: {
    margin: 0,
    color: "#5F704B",
    fontSize: "16px",
    fontWeight: 750,
    lineHeight: 1.5,
    wordBreak: "keep-all",
  },

  answerTestGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  answerTestCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "18px",
    padding: "16px",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.05)",
  },

  answerTestCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },

  answerTestCategory: {
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  answerTestCheck: {
    color: "#8A6A18",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  answerTestQuestion: {
    margin: "0 0 10px",
    color: "#FFFFFF",
    background: "#5F8D4E",
    borderRadius: "999px",
    display: "inline-flex",
    padding: "7px 12px",
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1.35,
    wordBreak: "keep-all",
  },

  answerTestFocus: {
    margin: "0 0 10px",
    color: "#6B7F5A",
    background: "#FFF7D8",
    border: "1px solid #E5C66D",
    borderRadius: "14px",
    padding: "9px 11px",
    fontSize: "13px",
    fontWeight: 850,
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },

  answerTestAnswer: {
    margin: 0,
    color: "#42553A",
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.55,
    wordBreak: "keep-all",
  },

  exampleBox: {
    background: "#F3EEDC",
    borderRadius: "16px",
    padding: "7px 10px",
    display: "grid",
    gridTemplateColumns: "96px 1fr",
    alignItems: "center",
    gap: "8px",
  },

  answerBubbleLabel: {
    display: "block",
    marginBottom: "4px",
    color: "#6B7F5A",
    fontSize: "11px",
    fontWeight: 950,
    lineHeight: 1.1,
  },

  chatComposer: {
    position: "relative",
    zIndex: 10,
    background: "#FFFDF6",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    flexShrink: 0,
    pointerEvents: "auto",
  },

  exampleTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontWeight: 900,
    fontSize: "14px",
    whiteSpace: "nowrap",
  },

  quickQuestionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
    overflow: "visible",
  },

  quickQuestionButton: {
    border: "1px solid #D8CFB3",
    background: "#FFFFFF",
    color: "#345A2F",
    borderRadius: "999px",
    padding: "6px 8px",
    fontSize: "12px",
    fontWeight: 900,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    cursor: "pointer",
    wordBreak: "keep-all",
    minWidth: 0,
  },

  inputArea: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "999px",
    padding: "6px",
    display: "flex",
    gap: "6px",
    flexShrink: 0,
    position: "relative",
    zIndex: 11,
    pointerEvents: "auto",
  },

  speechErrorNotice: {
    background: "#FFF1D6",
    border: "1px solid #E9C879",
    borderRadius: "18px",
    padding: "12px 16px",
    color: "#5B4A21",
    fontSize: "15px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  input: {
    flex: 1,
    minWidth: 0,
    border: "none",
    borderRadius: "999px",
    padding: "11px 14px",
    fontSize: "15px",
    outline: "none",
    background: "transparent",
    pointerEvents: "auto",
  },

  sendButton: {
    border: "none",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "0 20px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },

  voiceButton: {
    border: "none",
    background: "#F1EBD8",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "0 15px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  bottomNav: {
    height: "58px",
    borderTop: "1px solid #ECE6D3",
    background: "#FFFFFF",
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
  },

  navItem: {
    border: "none",
    background: "transparent",
    color: "#5F704B",
    fontSize: "12px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "2px",
    cursor: "pointer",
  },

  navItemActive: {
    border: "none",
    background: "#F2F7EA",
    color: "#2F4F2F",
    fontSize: "12px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "2px",
    cursor: "pointer",
  },

  navLogo: {
    width: "27px",
    height: "27px",
    objectFit: "contain",
  },

  waterPromptBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(47, 79, 47, 0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "22px",
    zIndex: 10,
  },

  waterPromptCard: {
    width: "min(760px, 92%)",
    background: "#FFFDF6",
    border: "2px solid #E5C66D",
    borderRadius: "28px",
    boxShadow: "0 18px 38px rgba(75, 90, 65, 0.24)",
    padding: "22px",
    display: "grid",
    gridTemplateColumns: "172px 1fr",
    gap: "28px",
    alignItems: "center",
  },

  waterPromptPlant: {
    width: "142px",
    height: "142px",
    objectFit: "contain",
    background: "#F6F1DE",
    borderRadius: "24px",
    padding: "10px",
    boxSizing: "border-box",
    justifySelf: "center",
  },

  waterPromptTextBox: {
    minWidth: 0,
  },

  waterPromptTitle: {
    margin: "4px 0 8px",
    color: "#2F4F2F",
    fontSize: "28px",
    fontWeight: 950,
    wordBreak: "keep-all",
  },

  waterPromptText: {
    margin: 0,
    color: "#5F704B",
    fontSize: "17px",
    fontWeight: 800,
    lineHeight: 1.5,
    wordBreak: "keep-all",
  },

  waterPromptActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "16px",
  },

  waterPromptPrimary: {
    border: "none",
    background: "#5F8D4E",
    color: "#FFFFFF",
    borderRadius: "999px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
  },

  waterPromptSecondary: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
  },

  waterPromptGhost: {
    border: "1px solid #E4DABF",
    background: "#FFFFFF",
    color: "#5F704B",
    borderRadius: "999px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
  },
};
