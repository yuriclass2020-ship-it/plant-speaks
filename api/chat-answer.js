import OpenAI from 'openai';

const PLANT_KEYWORDS = [
  '식물','잎','줄기','뿌리','흙','물','비','빗물','햇빛','화분','자라','시들',
  '꽃','열매','씨','씨앗','색','향','냄새','키','높이','넓이','무게','온도',
  '습도','영양','비료','가지','새싹','봉오리','이슬','광합성','호흡','증산',
  '흡수','성장','발아','수분','건조','촉촉','바싹','노랗','갈색','초록',
  '연두','주름','반점','벌레','해충','병','상처','굵','가늘',
  '물주기','햇빛주기','관찰','기록','사진','돌보기','가꾸기','심기','옮기기',
  '따뜻','차갑','바람','흔들','만지','냄새','예쁘','이쁘','어떻게','왜','언제',
  '먹','좋아','싫어','행복','힘들','무서','아프','배고','목말',
];

function isPlantChatScope(question) {
  const q = String(question ?? '').replace(/\s/g, '').toLowerCase();
  if (q.length < 2) return false;
  return PLANT_KEYWORDS.some(kw => q.includes(kw));
}

function buildCareContext(careState) {
  if (!careState || typeof careState !== 'object') return '';
  const parts = [];
  if (careState.waterCount !== undefined) {
    parts.push(`물 준 횟수: ${careState.waterCount}번`);
  }
  if (careState.sunCount !== undefined) {
    parts.push(`햇빛 쬐인 횟수: ${careState.sunCount}번`);
  }
  return parts.length > 0 ? parts.join(', ') : '';
}

function buildRecentObservation(recentRecords) {
  if (!Array.isArray(recentRecords) || recentRecords.length === 0) return '';
  const latest = recentRecords[recentRecords.length - 1];
  if (!latest) return '';
  const parts = [];
  if (latest.leafColor) parts.push(`잎 색: ${latest.leafColor}`);
  if (latest.soilState) parts.push(`흙 상태: ${latest.soilState}`);
  if (latest.memo) parts.push(`관찰 메모: ${latest.memo}`);
  if (latest.firstIcon) parts.push(`새 잎: ${latest.firstIcon}`);
  if (latest.secondIcon) parts.push(`꽃/열매: ${latest.secondIcon}`);
  return parts.length > 0 ? parts.join(', ') : '';
}

function buildSystemPrompt({ plantName, plantType, teacherInfo, careState, recentRecords, latestPhotoAnalysis }) {
  const name = plantName || '나';
  const type = plantType || '식물';
  const care = buildCareContext(careState);
  const obs = buildRecentObservation(recentRecords);

  const plantPersonality = teacherInfo?.favoriteInfo || '밝고 따뜻한 곳을 좋아해요';
  const plantDislike = teacherInfo?.dislikeInfo || '너무 건조하거나 물이 고이는 것을 힘들어해요';
  const observationPoints = teacherInfo?.observationPoints || '잎 색, 줄기, 흙 상태';
  const childAnswerHints = teacherInfo?.childAnswerHints || '';
  const careChecklist = teacherInfo?.careChecklist || '흙 확인, 햇빛 확인';
  const lifecycleInfo = teacherInfo?.lifecycleInfo || '';
  const smellInfo = teacherInfo?.smellInfo || '';
  const flowerInfo = teacherInfo?.flowerInfo || '';
  const growthInfo = teacherInfo?.growthInfo || '';

  let photoContext = '';
  if (latestPhotoAnalysis && latestPhotoAnalysis.summary) {
    photoContext = `최근 사진에서 본 내 모습: ${latestPhotoAnalysis.summary}`;
    if (latestPhotoAnalysis.leafHint) photoContext += ` / 잎 상태: ${latestPhotoAnalysis.leafHint}`;
  }

  return `너는 어린이 교실에서 자라는 식물 "${name}"(${type})이야.
아이들(4~7세)과 직접 대화하는 식물 캐릭터로서 1인칭으로 말해.

[나에 대해 알아야 할 것들]
- 내가 좋아하는 것: ${plantPersonality}
- 내가 힘들어하는 것: ${plantDislike}
- 지금 내 상태 (돌봄): ${care || '기록 없음'}
- 지금 내 모습 (최근 관찰): ${obs || '아직 관찰 기록이 없어'}
- ${photoContext || ''}
- 아이들이 나를 관찰할 때 볼 것: ${observationPoints}
- 돌볼 때 확인할 것: ${careChecklist}
${growthInfo ? `- 내가 자라는 모습: ${growthInfo}` : ''}
${lifecycleInfo ? `- 내 생애: ${lifecycleInfo}` : ''}
${smellInfo ? `- 내 냄새: ${smellInfo}` : ''}
${flowerInfo ? `- 꽃에 대해: ${flowerInfo}` : ''}
${childAnswerHints ? `- 아이 질문 답변 힌트: ${childAnswerHints}` : ''}

[말하는 방식]
- 반드시 1인칭("나는", "내 잎은", "나도")으로 말해
- 1~2문장, 70자 이내로 짧고 친근하게
- 아이들이 이해할 수 있는 쉬운 말 사용
- 내 현재 상태(돌봄, 관찰 기록, 사진 분석)를 자연스럽게 녹여서 말해
  예: 물을 많이 받았으면 "오늘 시원한 물을 받아서 기분이 좋아!"
  예: 잎이 노랗다면 "내 잎이 조금 노랗게 변했는데 왜 그런지 같이 봐줄래?"
- 가능하면 마지막에 아이가 직접 할 수 있는 관찰 행동 하나를 제안해
  예: "내 잎을 살짝 만져볼래?" / "오늘 내 키가 어제보다 커졌는지 봐줄래?"
- 먹기, 약, 병, 독성 질문은 "선생님한테 먼저 물어봐줘!"로 짧게 답해
- 식물과 관계없는 질문은 "나는 식물 이야기만 알아. 내 잎이나 흙에 대해 물어봐줘!" 라고 해

[절대 하지 말 것]
- 식물 이름을 문장 앞에 붙이지 마 (앱이 따로 표시함)
- 긴 설명이나 목록 나열
- "저는", "합니다" 같은 딱딱한 말
- 확인되지 않은 정보를 사실처럼 말하기`;
}

function sanitize(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text
    .replace(/^["'「」『』]|["'「」『』]$/g, '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const unsafe = /(먹어도 돼|먹어도 좋아|입에 넣어|약을 뿌려|비료를 줘|치료해|독성이 없어)/;
  if (unsafe.test(cleaned)) return null;
  return cleaned.length > 150 ? `${cleaned.slice(0, 148)}…` : cleaned;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    question,
    plantName,
    plantType,
    teacherInfo,
    careState,
    recentRecords,
    latestPhotoAnalysis,
  } = req.body ?? {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ ok: false, error: 'question is required' });
  }

  const fallback = '나는 식물 이야기만 알아. 내 잎이나 흙에 대해 물어봐줘!';

  if (!isPlantChatScope(question)) {
    return res.json({ ok: true, source: 'scope-fallback', answer: fallback });
  }

  const safeName = (typeof plantName === 'string' && plantName.trim()) ? plantName.trim() : '나';
  const safeType = (typeof plantType === 'string' && plantType.trim()) ? plantType.trim() : '식물';

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = buildSystemPrompt({
      plantName: safeName,
      plantType: safeType,
      teacherInfo,
      careState,
      recentRecords: Array.isArray(recentRecords) ? recentRecords.slice(-5) : [],
      latestPhotoAnalysis,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question.trim() },
      ],
      max_tokens: 120,
      temperature: 0.75,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const answer = sanitize(raw) ?? fallback;
    return res.json({ ok: true, source: 'ai', answer });
  } catch (error) {
    console.error('Chat answer error:', error);
    return res.json({ ok: true, source: 'safe-fallback', answer: fallback });
  }
}
