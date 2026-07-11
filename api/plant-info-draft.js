import OpenAI from 'openai';

function getOpenAiApiKey(req) {
  const headerKey = req.headers['x-openai-api-key'];
  const bodyKey = req.body?.openAiApiKey;
  const key = typeof headerKey === 'string' ? headerKey : bodyKey;
  return typeof key === 'string' ? key.trim() : '';
}

function buildPrompt(plantType) {
  return [
    `식물 이름 또는 종류: ${plantType}`,
    '',
    '어린이 교실 관찰 앱에서 교사가 확인할 식물 정보 초안을 한국어로 작성해 주세요.',
    '정확한 품종이나 식용 가능 여부가 불확실하면 단정하지 말고 선생님/어른 확인이 필요하다고 쓰세요.',
    '아이에게 바로 먹으라고 하거나 약품/비료 사용을 권하지 마세요.',
    '문장은 초등학생에게 설명하기 쉬운 말로 작성하되, 교사가 검토할 수 있도록 각 항목은 정보가 충분해야 합니다.',
    '아이들이 자주 묻는 질문에 답할 수 있게 "언제", "어떤 색", "얼마나", "무엇을 좋아/싫어", "왜 시들어", "먹어도 돼"에 대한 단서를 넣으세요.',
    'summary에는 이 식물이 어떤 식물인지, 아이가 바로 관찰할 대표 특징 2~3개를 쓰세요.',
    'edibleInfo에는 먹을 수 있는 부위, 먹을 수 있는 시기/상태, 어떻게 섭취하는지 예시, 먹기 전 확인할 위생/안전 조건을 쓰세요. 불확실하면 불확실하다고 쓰세요.',
    'flowerInfo에는 꽃이 필 수 있는지, 보통 꽃 색은 무엇인지, 어떤 시기/조건에서 피는지 쓰세요.',
    'fruitInfo에는 열매/씨앗이 생기는지, 생긴다면 색 변화나 관찰 시기를 쓰세요.',
    'observationPoints는 "잎 색, 줄기 길이, 흙 상태"처럼 쉼표로 구분한 짧은 명사 목록으로 5~8개 쓰세요.',
    'caution에는 아이가 하지 말아야 할 행동과 선생님께 알려야 할 상황을 쓰세요.',
    'growthInfo에는 얼마나/어떻게 자라는지 아이가 관찰할 수 있는 단서로 쓰세요.',
    'careInfo에는 물, 흙, 햇빛, 온도, 위치 돌봄 힌트를 쓰세요.',
    'recommendedWaterIntervalDays에는 보통 며칠마다 물을 확인/주는지 1~14 사이 숫자로 쓰세요. 불확실하면 2.',
    'recommendedSunGoal에는 하루에 햇빛 확인 횟수 1~5 사이 숫자로 쓰세요. 불확실하면 1.',
    'careChecklist에는 아이가 매일 확인할 돌봄 행동 3~5개를 쉼표로 구분해 쓰세요.',
    'lightInfo에는 좋아하는 빛, 피해야 할 빛, 둘 장소를 쓰세요.',
    'environmentInfo에는 어떤 환경과 계절 조건에서 지내기 좋은지 쓰세요.',
    'lifecycleInfo에는 얼마나 오래 살 수 있는지, 언제 시들기 쉬운지 쓰세요.',
    'smellInfo에는 향이나 냄새에 대한 정보와 이상한 냄새 시 안전 행동을 쓰세요.',
    'favoriteInfo에는 식물이 좋아하는 환경을 1~2문장으로 쓰세요.',
    'dislikeInfo에는 식물이 힘들어하는 환경과 나타날 수 있는 신호를 1~2문장으로 쓰세요.',
    'childAnswerHints에는 아이 질문에 답할 때 쓸 핵심 힌트 3~5개를 쓰세요.',
    '',
    '반드시 JSON만 출력하세요. 키: summary, edibleInfo, flowerInfo, fruitInfo, observationPoints, caution, growthInfo, careInfo, recommendedWaterIntervalDays, recommendedSunGoal, careChecklist, lightInfo, environmentInfo, lifecycleInfo, smellInfo, favoriteInfo, dislikeInfo, childAnswerHints',
  ].join('\n');
}

function parseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { plantType } = req.body ?? {};
  if (!plantType || typeof plantType !== 'string' || !plantType.trim()) {
    return res.status(400).json({ ok: false, error: 'plantType is required' });
  }

  try {
    const apiKey = getOpenAiApiKey(req);
    if (!apiKey) {
      return res.status(400).json({ ok: false, error: 'OpenAI API 키가 필요합니다.' });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '식물 정보 전문가입니다. 요청한 형식의 JSON만 출력합니다.',
        },
        { role: 'user', content: buildPrompt(plantType.trim()) },
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const data = parseJson(raw);

    if (!data) {
      return res.status(500).json({ ok: false, error: 'Failed to parse plant info' });
    }

    // 숫자 필드 검증
    const waterDays = Number(data.recommendedWaterIntervalDays);
    const sunGoal = Number(data.recommendedSunGoal);

    return res.json({
      ok: true,
      draft: {
        ...data,
        recommendedWaterIntervalDays: isNaN(waterDays) || waterDays < 1 ? 2 : Math.min(14, waterDays),
        recommendedSunGoal: isNaN(sunGoal) || sunGoal < 1 ? 1 : Math.min(5, sunGoal),
        confirmedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Plant info draft error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to generate plant info' });
  }
}
