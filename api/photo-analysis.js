import OpenAI from 'openai';

const PHOTO_ANALYSIS_SYSTEM = `어린이 교실 식물 관찰 앱에서 사진을 분석하는 AI입니다.
반드시 사진 속에서 실제로 보이는 시각 단서만 말하세요.
먼저 사진에 실제 살아있는 식물이나 화분이 보이는지 판단하세요.
식물이 아니면 isPlantPhoto를 false로 설정하세요.
병명, 원인을 단정하지 마세요. 약품, 비료 사용을 권하지 마세요.
반드시 JSON만 출력하세요.`;

function buildPrompt({ plantName, plantType }) {
  return [
    `식물 이름: ${plantName || '이 식물'}`,
    `식물 종류: ${plantType || '종류를 아직 모르는 식물'}`,
    '',
    '사진을 보고 아래 JSON 형식으로만 답변하세요:',
    '{',
    '  "isPlantPhoto": true/false,',
    '  "visibleDetails": "사진에서 보이는 것 1~2문장",',
    '  "uncertainDetails": "사진만으로 확인하기 어려운 것 1문장",',
    '  "summary": "전체 상태 요약 1~2문장",',
    '  "leafHint": "잎 관찰 힌트 1문장",',
    '  "soilHint": "흙 관찰 힌트 1문장",',
    '  "action": "다음에 할 관찰 행동 1가지"',
    '}',
    '',
    '식물 사진이 아니면:',
    '- visibleDetails: "식물 사진이 아니에요. 실제 식물이나 화분이 보이지 않아요."',
    '- summary: "식물 사진이 아니에요. 실제 식물이 보이는 사진을 다시 올려 주세요."',
    '- action: "식물 전체, 잎, 흙이 보이게 다시 사진을 남겨 주세요."',
  ].join('\n');
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
  if (!data || typeof data !== 'object') {
    return {
      isPlantPhoto: false,
      visibleDetails: '사진 분석에 실패했어요.',
      uncertainDetails: '다시 시도해 주세요.',
      summary: '사진 분석에 실패했어요.',
      leafHint: '선생님과 함께 잎을 직접 확인해 주세요.',
      soilHint: '흙을 직접 만져 확인해 주세요.',
      action: '다시 사진을 찍어 올려 주세요.',
    };
  }
  return {
    isPlantPhoto: Boolean(data.isPlantPhoto),
    visibleDetails: String(data.visibleDetails ?? ''),
    uncertainDetails: String(data.uncertainDetails ?? ''),
    summary: String(data.summary ?? ''),
    leafHint: String(data.leafHint ?? ''),
    soilHint: String(data.soilHint ?? ''),
    action: String(data.action ?? ''),
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
  const safeType = (typeof plantType === 'string' && plantType.trim()) ? plantType.trim() : '종류를 아직 모르는 식물';

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PHOTO_ANALYSIS_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt({ plantName: safeName, plantType: safeType }) },
            { type: 'image_url', image_url: { url: imageData, detail: 'auto' } },
          ],
        },
      ],
      max_tokens: 400,
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
