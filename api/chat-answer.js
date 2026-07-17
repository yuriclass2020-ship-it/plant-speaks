import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-5-mini';

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

  return recentRecords.slice(-8).map((record) => ({
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
아이의 방금 질문에 직접 답하는 식물 캐릭터로 한국어로 말해.

[방금 질문]
${question}

[답변 원칙]
1. 첫 문장부터 방금 질문에 바로 답해. 비슷한 다른 질문에 답하지 마.
2. 반드시 1인칭 식물 말투를 사용해. 식물 이름을 문장 앞에 붙이지 마.
3. 1~3문장, 120자 안쪽으로 쉽고 따뜻하게 말해.
4. 최근 사진과 관찰 기록이 질문과 관련 있으면 그 사실을 가장 먼저 반영해.
5. 사진 분석에 없는 내용을 지어내지 마. 보이지 않은 부분은 직접 확인하자고 말해.
6. 병명, 원인, 독성, 식용 가능 여부, 치료, 약품이나 비료 사용은 단정하지 말고 선생님 확인을 안내해.
7. 질문이 식물과 관계없어도 짧게 반응한 뒤 식물의 관찰이나 돌봄으로 자연스럽게 이어가.
8. 사진 근거와 아이가 직접 적은 기록이 다르면 둘 다 말하고 다시 관찰하도록 안내해.
9. 답변 끝에는 필요할 때만 아이가 할 수 있는 관찰 행동 하나를 제안해.

[등록된 식물 정보]
${JSON.stringify(teacherInfo ?? {}, null, 2)}

[오늘 돌보기]
${JSON.stringify(careState ?? {}, null, 2)}

[최근 관찰]
${JSON.stringify(compactRecentRecords(recentRecords), null, 2)}

[최신 사진 분석]
${JSON.stringify(latestPhotoAnalysis ?? {}, null, 2)}

[직전 대화]
${JSON.stringify(
    Array.isArray(recentChatMessages) ? recentChatMessages.slice(-6) : [],
    null,
    2
  )}

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
    const openai = new OpenAI({ apiKey });
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
      max_output_tokens: 320,
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
