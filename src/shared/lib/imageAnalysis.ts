import type { LeafColor } from '../../types/record';

export type SuggestionConfidence = 'low' | 'medium';

export interface PhotoSuggestion {
  recommendedLeafColor: LeafColor;
  confidence: SuggestionConfidence;
  summary: string;
  photoGuide: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'));
    image.src = src;
  });
}

export async function analyzePlantPhoto(
  dataUrl: string
): Promise<PhotoSuggestion> {
  const image = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 분석을 시작할 수 없어요.');
  }

  const maxSize = 160;
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);

  canvas.width = Math.max(1, Math.floor(image.width * scale));
  canvas.height = Math.max(1, Math.floor(image.height * scale));

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  let totalPixels = 0;
  let brightnessSum = 0;
  let greenPixels = 0;
  let yellowPixels = 0;
  let brownPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 40) continue;

    totalPixels += 1;
    brightnessSum += (r + g + b) / 3;

    const isGreenish = g > r * 1.08 && g > b * 1.05 && g > 60;
    const isYellowish = r > 100 && g > 90 && b < g * 0.85 && Math.abs(r - g) < 90;
    const isBrownish = r > 70 && g > 40 && r > g * 1.05 && b < g * 0.9;

    if (isGreenish) greenPixels += 1;
    if (isYellowish) yellowPixels += 1;
    if (isBrownish) brownPixels += 1;
  }

  if (totalPixels === 0) {
    return {
      recommendedLeafColor: 'good',
      confidence: 'low',
      summary: '사진에서 식물을 충분히 찾지 못했어요.',
      photoGuide: '식물이 화면 가운데 크게 보이도록 다시 찍어 주세요.',
    };
  }

  const averageBrightness = brightnessSum / totalPixels;
  const greenRatio = greenPixels / totalPixels;
  const yellowRatio = yellowPixels / totalPixels;
  const brownRatio = brownPixels / totalPixels;

  if (averageBrightness < 55) {
    return {
      recommendedLeafColor: 'pale',
      confidence: 'low',
      summary: '사진이 조금 어두워서 잎 색이 정확하지 않을 수 있어요.',
      photoGuide: '창가나 밝은 곳에서 다시 찍으면 더 잘 분석할 수 있어요.',
    };
  }

  if (brownRatio > 0.12) {
    return {
      recommendedLeafColor: 'brown',
      confidence: 'medium',
      summary: '갈색에 가까운 부분이 조금 보여요.',
      photoGuide: '잎 끝부분이 잘 보이게 다시 확인해 주세요.',
    };
  }

  if (yellowRatio > 0.14) {
    return {
      recommendedLeafColor: 'yellow',
      confidence: 'medium',
      summary: '노란빛으로 보이는 부분이 있어요.',
      photoGuide: '같은 각도로 한 번 더 찍어서 비교해 보면 좋아요.',
    };
  }

  if (greenRatio > 0.18) {
    return {
      recommendedLeafColor: 'good',
      confidence: 'medium',
      summary: '초록 잎이 비교적 잘 보여요.',
      photoGuide: '지금 사진으로 잎 색 확인은 무난해 보여요.',
    };
  }

  return {
    recommendedLeafColor: 'pale',
    confidence: 'low',
    summary: '잎 색이 조금 연하게 보이지만 확실하지는 않아요.',
    photoGuide: '식물이 가까이 보이게 다시 찍으면 더 정확해져요.',
  };
}
