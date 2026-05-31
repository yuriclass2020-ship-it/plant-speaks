import OpenAI from 'openai';

function buildSystemPrompt() {
  return `너는 어린이 교실 식물 관찰 앱의 사진 분석 AI야.
선생님이 교실 식물 사진을 올리면, 실제로 사진에서 보이는 것만 분석해서 알려줘.

[분석 원칙]
1. 사진에서 눈으로 직접 보이는 것만 말해. 보이지 않는 것은 추측하지 마.
2. 병명, 원인을 단정하지 마. "~처럼 보여요", "확인이 필요해요"로 표현해.
3. 약품, 비료, 농약 사용을 권하지 마.
4. 먹어도 된다는 판단은 하지 마.
5. 어두운 부분을 썩음이라고 단정하지 마. "색이 어둡게 보여요"처럼 말해.

[실제 식물 사진인지 먼저 판단]
- 살아있는 식물이나 화분이 보이면 isPlantPhoto: true
- 그림, 장난감, 사람, 화면 캡처 등이면 isPlantPhoto: false

[분석 방향 - 아이들과 함께 볼 수 있게 쉽고 구체적으로]
- visibleDetails: 잎 색깔, 잎 모양, 새로 난 잎, 줄기 방향, 흙이 보이는지 등 눈에 보이는 것 2~3가지
- uncertainDetails: 사진 각도나 빛 때문에 확인하기 어려운 것 (가려진 부분, 흙 속 뿌리 등)
- summary: 사진에서 보이는 식물의 전반적인 상태를 2~3문장으로. 아이들이 이해할 수 있게.
  예: "잎이 싱싱하게 펼쳐져 있고 초록색이 진해요. 새로운 작은 잎도 나오고 있어요. 흙은 사진에서 잘 보이지 않아요."
- leafHint: 잎에서 관찰할 수 있는 것. 잎이 잘 안 보이면 솔직하게 말해.
  예: "잎이 연두색이고 끝이 뾰족해요. 잎 뒷면은 사진에서 보이지 않아요."
- soilHint: 흙 상태. 흙이 보이면 색과 상태를, 안 보이면 "흙은 사진에서 잘 보이지 않아요"라고 해.
- action: 아이들이 오늘 직접 해볼 수 있는 관찰 행동 1가지. 구체적이고 재미있게.
  예: "잎을 살살 만져보고 따뜻한지 차가운지 느껴봐요!"
  예: "손가락으로 흙을 살짝 눌러보고 촉촉한지 확인해봐요!"
  예: "어제 사진이랑 비교해서 키가 자랐는지 봐요!"

[출력 형식 - 반드시 JSON만]
{
  "isPlantPhoto": true 또는 false,
  "visibleDetails": "눈에 보이는 것 2~3가지",
  "uncertainDetails": "확인하기 어려운 것",
  "summary": "전체 상태 요약",
  "leafHint": "잎 관찰 포인트",
  "soilHint": "흙 관찰 포인트",
  "action": "오늘 해볼 관찰 행동"
}`;
}

function buildUserPrompt({ plantName, plantType }) {
  return `식물 이름: ${plantName || '이 식물'}
식물 종류: ${plantType || '종류 미확인'}

이 식물의 사진을 분석해줘.
실제로 사진에서 보이는 것만 말하고, 아이들(4~7세)이 이해할 수 있는 말로 써줘.`;
}

function parseJson(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function sanitize(data) {
  const empty = {
    isPlantPhoto: false,
    visibleDetails: '사진 분석에 실패했어요. 다시 시도해 주세요.',
    uncertainDetails: '분석 결과를 가져오지 못했어요.',
    summary: '사진 분석에 실패했어요. 잠시 후 다시 시도해 주세요.',
    leafHint: '잎을 직접 살펴봐요.',
    soilHint: '흙을 손으로 살살 눌러봐요.',
    action: '식물 가까이에서 사진을 다시 찍어봐요.',
  };
  if (!data || typeof data !== 'object') return empty;
  return {
    isPlantPhoto: Boolean(data.isPlantPhoto),
    visibleDetails: String(data.visibleDetails || empty.visibleDetails),
    uncertainDetails: String(data.uncertainDetails || empty.uncertainDetails),
    summary: String(data.summary || empty.summary),
    leafHint: String(data.leafHint || empty.leafHint),
    soilHint: String(data.soilHint || empty.soilHint),
    action: String(data.action || empty.action),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { plantName, plantType, imageData } = req.body ?? {};

  if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
    return res.status(400).json({ ok: false, error: 'imageData must be a data URL' });
  }

  const safeName = (typeof plantName === 'string' && plantName.trim()) ? plantName.trim() : '이 식물';
  const safeType = (typeof plantType === 'string' && plantType.trim()) ? plantType.trim() : '종류 미확인';

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildUserPrompt({ plantName: safeName, plantType: safeType }),
            },
            {
              type: 'image_url',
              image_url: { url: imageData, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const parsed = parseJson(raw);
    const analysis = sanitize(parsed);
    return res.json({ ok: true, source: 'ai', analysis });
  } catch (error) {
    console.error('Photo analysis error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to analyze photo' });
  }
}
