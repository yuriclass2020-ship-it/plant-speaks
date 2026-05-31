import OpenAI from 'openai';

const SYSTEM_PROMPT = `어린이 교실 식물 관찰 앱의 식물 캐릭터로 한국어 답변을 작성하세요.

중요 규칙:
- 답변은 1~2문장, 90자 이내로 짧게 작성하세요.
- 아이에게 따뜻하게 답하되 식물이 실제 사람 감정, 가족, 결혼, 꿈, 생각을 가진다고 단정하지 마세요.
- 엉뚱한 질문도 식물 입장에서 짧게 받아주고, 반드시 관찰 행동으로 연결하세요.
- 모르는 식물 정보는 지어내지 말고 관찰로 연결하세요.
- 먹기, 만지기, 약, 비료, 병, 독성, 치료 판단은 하지 말고 선생님/어른 확인을 말하세요.
- 최근 기록과 교사 확인 정보가 있으면 우선 반영하세요.
- 마지막에는 가능하면 잎, 줄기, 흙, 햇빛, 사진 중 하나를 관찰하도록 자연스럽게 이어 주세요.
- 식물 이름을 앞에 붙이지 마세요. 앱이 화면에서 이름을 따로 붙입니다.`;

const PLANT_KEYWORDS = [
  '식물','잎','줄기','뿌리','흙','물','비','빗물','햇빛','화분','자라','시들',
  '꽃','열매','씨','씨앗','색','향','냄새','키','높이','넓이','무게','온도',
  '습도','영양','비료','가지','새싹','봉오리','이슬','광합성','호흡','증산',
  '뿌리','흡수','성장','발아','수분','건조','촉촉','바싹','노랗','갈색','초록',
  '연두','주름','반점','곰팡이','벌레','해충','병','상처','줄기','굵','가늘',
  '물주기','햇빛주기','관찰','기록','사진','돌보기','가꾸기','심기','옮기기',
];

function isPlantChatScope(question) {
  const q = String(question ?? '').replace(/\s/g, '').toLowerCase();
  return PLANT_KEYWORDS.some(kw => q.includes(kw));
}

function sanitizeChatAnswer(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text
    .replace(/^["']|["']$/g, '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const unsafe = /(먹어도 돼|먹어도 좋아|입에 넣어|약을 뿌려|비료를 줘|치료해|병에 걸렸|독성이 없)/;
  if (unsafe.test(cleaned)) return null;
  return cleaned.length > 120 ? `${cleaned.slice(0, 118)}…` : cleaned;
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

  const fallback = '나는 식물 이야기만 대답할 수 있어요. 내 잎, 흙, 물, 햇빛에 대해 물어봐 주세요.';

  if (!isPlantChatScope(question)) {
    return res.json({ ok: true, source: 'scope-fallback', answer: fallback });
  }

  const safeName = (typeof plantName === 'string' && plantName.trim()) ? plantName.trim() : '이 식물';
  const safeType = (typeof plantType === 'string' && plantType.trim()) ? plantType.trim() : '종류를 아직 모르는 식물';

  const userPrompt = [
    `식물 이름: ${safeName}`,
    `식물 종류: ${safeType}`,
    `아이 질문: ${question.trim()}`,
    '',
    '교사 확인 정보:',
    JSON.stringify(teacherInfo ?? {}, null, 2),
    '',
    '돌보기 상태:',
    JSON.stringify(careState ?? {}, null, 2),
    '',
    '최근 관찰 기록:',
    JSON.stringify((Array.isArray(recentRecords) ? recentRecords.slice(-8) : []), null, 2),
    '',
    '최근 사진 분석:',
    JSON.stringify(latestPhotoAnalysis ?? {}, null, 2),
  ].join('\n');

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const answer = sanitizeChatAnswer(raw) ?? fallback;
    return res.json({ ok: true, source: 'ai', answer });
  } catch (error) {
    console.error('Chat answer error:', error);
    return res.json({ ok: true, source: 'safe-fallback', answer: fallback });
  }
}
