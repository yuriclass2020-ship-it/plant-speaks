import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-4.1-mini';

function getOpenAiApiKey(req) {
  const headerKey = req.headers['x-openai-api-key'];
  const bodyKey = req.body?.openAiApiKey;
  const key = typeof headerKey === 'string' ? headerKey : bodyKey;
  return typeof key === 'string' ? key.trim() : '';
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function sanitize(text, fallbackAnswer) {
  const cleaned = cleanText(text)
    .replace(/^["'「」『』]|["'「」『』]$/g, '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')
    .trim();

  if (!cleaned) return fallbackAnswer;

  const unsafe =
    /(먹어도 돼|먹어도 좋아|입에 넣어|약을 뿌려|농약을 뿌려|비료를 줘|치료해|병에 걸렸|독성이 없)/;
  if (unsafe.test(cleaned)) return fallbackAnswer;

  return cleaned.length > 180 ? `${cleaned.slice(0, 178)}…` : cleaned;
}

function compactRecentRecords(recentRecords) {
  if (!Array.isArray(recentRecords)) return [];

  return recentRecords.slice(-5).map((record) => ({
    type: record?.type,
    title: cleanText(record?.title),
    date: cleanText(record?.date),
    firstObservation: cleanText(record?.firstValue),
    secondObservation: cleanText(record?.secondValue),
    memo: cleanText(record?.memo),
    photoSummary: cleanText(record?.photoAnalysis?.summary),
    photoVisibleDetails: cleanText(record?.photoAnalysis?.visibleDetails),
    photoComparison: cleanText(record?.photoAnalysis?.comparison),
    photoDialogueContext: cleanText(record?.photoAnalysis?.dialogueContext),
  }));
}

function compactRecentChatMessages(recentChatMessages) {
  if (!Array.isArray(recentChatMessages)) return [];

  return recentChatMessages.slice(-6).map((message) => ({
    child: cleanText(message?.question),
    plant: cleanText(message?.answer),
  }));
}

function buildPrompt({
  question,
  fallbackAnswer,
  plantName,
  plantType,
  teacherInfo,
  careState,
  recentRecords,
  recentChatMessages,
  latestPhotoAnalysis,
}) {
  return `너는 유아 교실에서 자라는 식물 "${plantName}"(${plantType})이야.
아이와 앞뒤가 이어지는 짧은 대화를 나누는 식물 캐릭터로 한국어로 말해.

[답변 원칙]
1. 먼저 아이의 현재 말이 질문, 후속 질문, 감정, 칭찬, 바람, 인사 중 무엇인지 문맥으로 판단해.
2. 질문이면 첫 문장부터 물은 것에 답하고, 감정·칭찬·바람이면 그 내용을 구체적으로 받아줘. 무조건 식물 정보 설명으로 바꾸지 마.
3. "그거", "그러면", "왜", "언제", "궁금해"처럼 대상이 생략되면 직전 대화에서 대상을 찾아 이어서 답해.
4. 직전 대화와 현재 말이 충돌하지 않는 한 같은 주제를 유지해. 관련 없는 품종 정보나 관찰 항목으로 화제를 돌리지 마.
5. 반드시 1인칭 식물 말투를 사용하고 식물 이름을 문장 앞에 붙이지 마.
6. 1~3문장, 120자 안쪽으로 쉽고 따뜻하게 말해.
7. 최근 사진과 관찰 기록은 현재 말과 직접 관련 있을 때만 사용해. 사진에 없는 내용은 지어내지 마.
8. 병명, 원인, 독성, 식용 가능 여부, 치료, 약품이나 비료 사용은 단정하지 말고 선생님 확인을 안내해.
9. 관찰 행동은 현재 대화에 도움이 될 때만 한 가지 제안해. 모든 답변에 억지로 붙이지 마.
10. 맛이나 먹기 질문은 물은 맛에 먼저 답하되, 선생님 확인 전에는 먹지 않도록 안내해.

[등록된 식물 정보]
${JSON.stringify(teacherInfo ?? {})}

[오늘 돌보기]
${JSON.stringify(careState ?? {})}

[최근 관찰]
${JSON.stringify(compactRecentRecords(recentRecords))}

[최신 사진 분석]
${JSON.stringify(latestPhotoAnalysis ?? {})}

[직전 대화]
${JSON.stringify(compactRecentChatMessages(recentChatMessages))}

[아이의 현재 말]
${question}

위 현재 말에만 답해. 직전 대화는 생략된 대상을 이해하는 데 사용해.

[AI가 실패할 때 사용할 안전 답변]
${fallbackAnswer}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    question,
    fallbackAnswer,
    plantName,
    plantType,
    teacherInfo,
    careState,
    recentRecords,
    recentChatMessages,
    latestPhotoAnalysis,
  } = req.body ?? {};

  if (!question || typeof question !== 'string') {
    return res.status(400).json({
      ok: false,
      error: '질문을 확인하지 못했어요.',
    });
  }

  const safeFallback =
    cleanText(fallbackAnswer) ||
    '그 질문은 지금 바로 알기 어려워요. 내 잎과 흙을 함께 살펴볼래?';
  const safeName = cleanText(plantName) || '이 식물';
  const safeType = cleanText(plantType) || '종류 미확인 식물';
  const apiKey = getOpenAiApiKey(req);

  if (!apiKey) {
    return res.status(400).json({
      ok: false,
      error: 'OpenAI API 키가 필요해요.',
    });
  }

  try {
    const openai = new OpenAI({
      apiKey,
      timeout: 10000,
      maxRetries: 0,
    });
    const response = await openai.responses.create({
      model: process.env.OPENAI_CHAT_MODEL || DEFAULT_MODEL,
      input: buildPrompt({
        question: question.trim(),
        fallbackAnswer: safeFallback,
        plantName: safeName,
        plantType: safeType,
        teacherInfo,
        careState,
        recentRecords,
        recentChatMessages,
        latestPhotoAnalysis,
      }),
      max_output_tokens: 220,
    });

    return res.json({
      ok: true,
      source: 'ai',
      answer: sanitize(response.output_text, safeFallback),
    });
  } catch (error) {
    console.error('Chat answer error:', error);
    return res.json({
      ok: true,
      source: 'safe-fallback',
      answer: safeFallback,
      warning:
        error instanceof Error ? error.message : 'AI 답변을 만들지 못했어요.',
    });
  }
}
