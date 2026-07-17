import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-5-mini';

function getOpenAiApiKey(req) {
  const headerKey = req.headers['x-openai-api-key'];
  const bodyKey = req.body?.openAiApiKey;
  const key = typeof headerKey === 'string' ? headerKey : bodyKey;
  return typeof key === 'string' ? key.trim() : '';
}

function cleanText(value, fallback = '') {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text || fallback;
}

function cleanEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sanitize(data) {
  const isPlantPhoto = data?.isPlantPhoto === true;
  const fallbackSummary = isPlantPhoto
    ? '식물의 모습은 보이지만 사진에서 확인할 수 있는 정보가 많지 않아요.'
    : '실제 식물을 분명하게 확인하기 어려워요.';

  return {
    isPlantPhoto,
    visibleDetails: cleanText(
      data?.visibleDetails,
      isPlantPhoto
        ? '사진에서 식물의 전체 모습이 보여요.'
        : '실제 식물이나 화분이 분명하게 보이지 않아요.'
    ),
    uncertainDetails: cleanText(
      data?.uncertainDetails,
      '사진만으로 확인하기 어려운 부분이 있어요.'
    ),
    summary: cleanText(data?.summary, fallbackSummary),
    leafHint: cleanText(
      data?.leafHint,
      isPlantPhoto ? '잎의 색과 모양을 직접 확인해 주세요.' : '잎을 확인할 수 없어요.'
    ),
    soilHint: cleanText(
      data?.soilHint,
      isPlantPhoto ? '흙이 보이는지 확인해 주세요.' : '흙을 확인할 수 없어요.'
    ),
    action: cleanText(
      data?.action,
      '식물 전체와 잎, 흙이 보이게 사진을 다시 남겨 주세요.'
    ),
    suggestedPlantType: isPlantPhoto ? cleanText(data?.suggestedPlantType) : '',
    identificationConfidence: cleanEnum(
      data?.identificationConfidence,
      ['high', 'medium', 'low'],
      'low'
    ),
    photoQuality: cleanEnum(
      data?.photoQuality,
      ['good', 'usable', 'poor'],
      'poor'
    ),
    visibleFeatures: Array.isArray(data?.visibleFeatures)
      ? data.visibleFeatures
          .map((item) => cleanText(item))
          .filter(Boolean)
          .slice(0, 5)
      : [],
    condition: cleanEnum(
      data?.condition,
      ['healthy', 'observe', 'unclear'],
      'unclear'
    ),
    comparison: cleanText(data?.comparison),
    dialogueContext: cleanText(
      data?.dialogueContext,
      cleanText(data?.summary, fallbackSummary)
    ),
    checkedAt: new Date().toISOString(),
  };
}

function buildPrompt({
  plantName,
  plantType,
  purpose,
  previousAnalysis,
  previousDate,
}) {
  const isRegistration = purpose === 'registration';
  const comparisonContext = previousAnalysis
    ? [
        '',
        '[이전 사진 기록]',
        `날짜: ${previousDate || '날짜 미상'}`,
        `이전 요약: ${cleanText(previousAnalysis.summary, '없음')}`,
        `이전 잎 관찰: ${cleanText(previousAnalysis.leafHint, '없음')}`,
        `이전 흙 관찰: ${cleanText(previousAnalysis.soilHint, '없음')}`,
      ].join('\n')
    : '';

  return `너는 유아 교실의 식물 관찰을 돕는 비전 분석 AI야.

[현재 정보]
- 식물 별명: ${plantName || '새 식물'}
- 등록된 종류: ${plantType || '종류 미확인'}
- 목적: ${isRegistration ? '처음 등록할 식물 알아보기' : '관찰 사진 기록'}
${comparisonContext}

[가장 중요한 규칙]
1. 사진에서 직접 보이는 시각 단서만 말해. 병명, 원인, 수분량, 독성, 식용 여부를 단정하지 마.
2. 어두운 색을 썩음이나 병으로 부르지 마. 보이는 색과 모양만 표현해.
3. 실제 살아있는 식물이나 화분이 분명하지 않으면 isPlantPhoto는 false로 써.
4. 식물 종류는 잎 모양, 줄기, 생김새가 충분히 보일 때만 suggestedPlantType에 적어.
5. 정확한 품종이 불확실하면 넓은 이름으로 적고 identificationConfidence를 low로 써.
6. 등록된 종류와 달라 보이더라도 확정하지 말고 교사 확인이 필요하다고 써.
7. 문장은 한국어로 짧고 구체적으로 써. 아이가 이해할 수 있는 표현을 사용해.

[필드 작성법]
- visibleDetails: 현재 사진에서 보이는 잎 색, 잎 모양, 줄기 방향, 새잎, 화분, 흙 중 2~4가지
- uncertainDetails: 가려짐, 조명, 초점 때문에 확인하기 어려운 부분
- summary: 현재 모습만 2문장 이내로 요약
- leafHint: 잎에서 실제로 보이는 점
- soilHint: 흙이 보이면 색과 표면 모습, 안 보이면 보이지 않는다고 명시
- action: 아이가 바로 할 수 있는 관찰 행동 1가지
- suggestedPlantType: 가장 가능성 높은 일반 식물명. 식별 불가하면 빈 문자열
- identificationConfidence: high, medium, low 중 하나
- photoQuality: good, usable, poor 중 하나
- visibleFeatures: 사진에서 보이는 핵심 특징 2~5개
- condition: 걱정되는 시각 단서가 뚜렷하지 않으면 healthy, 다시 확인할 단서가 있으면 observe, 판단하기 어려우면 unclear
- comparison: 이전 사진이 함께 제공됐을 때만 실제 두 사진에서 확인되는 변화. 없거나 비교가 어려우면 빈 문자열
- dialogueContext: 식물 캐릭터가 아이 질문에 사용할 수 있는 사실 1문장. 사진에서 보이는 사실만 사용

반드시 아래 키를 모두 가진 JSON 객체만 출력해:
isPlantPhoto, visibleDetails, uncertainDetails, summary, leafHint, soilHint, action,
suggestedPlantType, identificationConfidence, photoQuality, visibleFeatures,
condition, comparison, dialogueContext`;
}

function parseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    plantName,
    plantType,
    imageData,
    purpose = 'observation',
    previousAnalysis,
    previousImageData,
    previousDate,
  } = req.body ?? {};

  if (
    !imageData ||
    typeof imageData !== 'string' ||
    !imageData.startsWith('data:image/')
  ) {
    return res.status(400).json({
      ok: false,
      error: '사진 파일을 확인하지 못했어요.',
    });
  }

  const apiKey = getOpenAiApiKey(req);
  if (!apiKey) {
    return res.status(400).json({
      ok: false,
      error: 'OpenAI API 키가 필요해요.',
    });
  }

  const safeName =
    typeof plantName === 'string' && plantName.trim()
      ? plantName.trim()
      : '새 식물';
  const safeType =
    typeof plantType === 'string' && plantType.trim()
      ? plantType.trim()
      : '종류 미확인';

  try {
    const openai = new OpenAI({ apiKey });
    const content = [
      {
        type: 'input_text',
        text: buildPrompt({
          plantName: safeName,
          plantType: safeType,
          purpose,
          previousAnalysis,
          previousDate,
        }),
      },
    ];

    if (
      typeof previousImageData === 'string' &&
      previousImageData.startsWith('data:image/')
    ) {
      content.push({
        type: 'input_text',
        text: `이전 사진(${previousDate || '날짜 미상'})입니다. 다음 사진과 비교할 때만 사용하세요.`,
      });
      content.push({
        type: 'input_image',
        image_url: previousImageData,
        detail: 'low',
      });
    }

    content.push({
      type: 'input_text',
      text: '현재 분석할 사진입니다.',
    });
    content.push({
      type: 'input_image',
      image_url: imageData,
      detail: 'high',
    });

    const response = await openai.responses.create({
      model: process.env.OPENAI_PHOTO_ANALYSIS_MODEL || DEFAULT_MODEL,
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_object',
        },
      },
      max_output_tokens: 1200,
    });

    const parsed = parseJson(response.output_text);
    if (!parsed) {
      throw new Error('사진 분석 결과 형식을 확인하지 못했어요.');
    }

    return res.json({
      ok: true,
      source: 'ai',
      analysis: sanitize(parsed),
    });
  } catch (error) {
    console.error('Photo analysis error:', error);
    return res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : '사진을 분석하지 못했어요.',
    });
  }
}
