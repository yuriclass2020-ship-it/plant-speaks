import type { DailyPlantRecord } from '../types/record';
import type {
  PlantChildQuestionPreset,
  PlantSpeciesKey,
  PlantSpeciesPreset,
} from '../types/plantSpecies';

export const plantSpeciesPresets: PlantSpeciesPreset[] = [
  {
    key: 'lettuce',
    label: '상추',
    emoji: '🥬',
    shortDescription: '잎이 자라는 모습을 관찰하기 좋은 식물이에요.',
    basicInfo: {
      description: '상추는 잎을 중심으로 관찰하기 좋은 식물이에요.',
      mainParts: ['잎', '줄기'],
    },
    care: {
      water: '흙이 너무 오래 마르지 않게 살펴보면 좋아요.',
      sunlight: '밝은 곳을 좋아해요.',
    },
    growthInfo: {
      speedHint: '잎 변화가 비교적 보이기 쉬운 편이에요.',
      sizeHint: '잎이 점점 넓어지고 커지는 모습을 볼 수 있어요.',
      growthTimeHint: '며칠에서 몇 주 동안 천천히 자라는 변화를 볼 수 있어요.',
    },
    edibleInfo: {
      edible: true,
      edibleParts: ['잎'],
      harvestHint: '잎이 충분히 자랐는지 보고 선생님과 함께 정하면 좋아요.',
      teacherCheckRequired: true,
      caution: '먹기 전에는 꼭 선생님과 함께 확인해요.',
    },
    speciesFacts: {
      flowerExistence:
        '상추도 자라면 꽃을 볼 수 있지만, 교실에서는 잎 변화를 더 자주 관찰해.',
      fruitExistence: '상추는 열매보다 잎과 꽃대 변화를 더 많이 살펴보는 식물이야.',
      colorInfo:
        '상추 잎은 보통 초록색 계열이야. 종류와 상태에 따라 조금 연하거나 진하게 보일 수 있어.',
      ediblePartInfo: '상추는 주로 잎을 먹는 식물로 알려져 있어.',
      hungryInfo: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
    },
    observationPoints: ['잎 색', '잎 크기', '잎 수', '흙 상태'],
    observationTips: ['작은 잎과 큰 잎을 비교해 보세요.', '잎 색 변화를 살펴보세요.'],
    likelyFeatures: ['잎이 점점 커질 수 있어요.', '새 잎이 계속 나올 수 있어요.'],
    childQuestions: [
      {
        key: 'water',
        label: '물 필요해?',
        baseAnswer: '상추는 흙이 너무 오래 마르지 않으면 좋아.',
        observePrompt: '흙 상태를 다시 한 번 볼래?',
        condition: 'always',
      },
      {
        key: 'sunlight',
        label: '햇빛 좋아해?',
        baseAnswer: '나는 밝은 곳을 좋아하는 편이야.',
        observePrompt: '내 자리가 너무 어둡지 않은지도 봐 줘.',
        condition: 'always',
      },
      {
        key: 'growth',
        label: '왜 잎이 커져?',
        baseAnswer: '햇빛과 물을 받으면 잎이 조금씩 자랄 수 있어.',
        observePrompt: '작은 잎과 큰 잎을 같이 찾아볼래?',
        condition: 'always',
      },
      {
        key: 'newLeaf',
        label: '새 잎이 더 날까?',
        baseAnswer: '잘 자라면 새 잎이 또 나올 수도 있어.',
        observePrompt: '잎 사이를 자세히 들여다볼래?',
        condition: 'always',
      },
      {
        key: 'leafColor',
        label: '왜 잎 색이 달라?',
        baseAnswer: '잎 색은 빛과 물 상태에 따라 달라 보일 수도 있어.',
        observePrompt: '내 잎 색을 가까이에서 다시 볼래?',
        condition: 'yellowLeaf',
      },
      {
        key: 'help',
        label: '어떻게 도와줄까?',
        baseAnswer: '흙과 잎을 잘 살펴봐 주는 게 큰 도움이 돼.',
        observePrompt: '내 흙과 잎을 같이 확인해 줘.',
        condition: 'drySoil',
      },
      {
        key: 'edible',
        label: '먹어도 돼?',
        baseAnswer: '상추는 먹는 식물로 많이 알려져 있어.',
        observePrompt: '먹기 전에는 꼭 선생님과 같이 확인해 줘.',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'ediblePart',
        label: '뭘 먹어?',
        baseAnswer: '상추는 주로 잎을 먹는 식물로 알려져 있어.',
        observePrompt: '잎이 충분히 자랐는지 같이 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'harvest',
        label: '언제 먹을 수 있어?',
        baseAnswer: '잎이 충분히 자랐는지 보고 정하면 좋아.',
        observePrompt: '큰 잎과 작은 잎을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'size',
        label: '얼마나 더 커?',
        baseAnswer: '상추는 잎이 조금씩 더 커질 수 있어.',
        observePrompt: '오늘 잎 크기와 다음 기록을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'growthTime',
        label: '얼마나 더 걸려?',
        baseAnswer: '상추는 며칠에서 몇 주 동안 천천히 변할 수 있어.',
        observePrompt: '오늘 모습과 며칠 뒤 모습을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'color',
        label: '무슨 색이야?',
        baseAnswer: '상추 잎은 보통 초록색 계열이야.',
        observePrompt: '초록 잎과 다른 잎을 같이 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'flowerExist',
        label: '너도 꽃이 있어?',
        baseAnswer: '상추도 자라면 꽃을 볼 수 있지만, 잎을 더 자주 관찰해.',
        observePrompt: '잎과 꽃대 변화를 같이 생각해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'fruitExist',
        label: '너도 열매가 있어?',
        baseAnswer: '상추는 열매보다 잎과 꽃대 변화를 더 많이 살펴봐.',
        observePrompt: '지금은 잎 변화를 더 자세히 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'hungry',
        label: '배고파?',
        baseAnswer: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
        observePrompt: '흙과 빛 상태를 같이 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
    ],
    fallbackAnswers: {
      unknown: '그건 나도 아직 잘 모르겠어. 선생님과 같이 알아보자.',
      observeMore: '내 잎과 흙을 한 번 더 자세히 살펴봐 줄래?',
    },
  },
  {
    key: 'balsam',
    label: '봉선화',
    emoji: '🌸',
    shortDescription: '꽃과 씨앗 변화를 관찰하기 좋은 식물이에요.',
    basicInfo: {
      description: '봉선화는 꽃과 씨앗 변화를 관찰하기 좋은 식물이에요.',
      mainParts: ['잎', '줄기', '꽃', '씨앗'],
    },
    care: {
      water: '물을 좋아하는 편이라 흙이 너무 마르지 않게 보면 좋아요.',
      sunlight: '밝은 햇빛을 좋아해요.',
    },
    growthInfo: {
      speedHint: '꽃이 피는 변화를 기다리며 관찰하기 좋은 식물이에요.',
      sizeHint: '줄기와 잎이 더 자라고 꽃 변화도 이어질 수 있어요.',
      growthTimeHint: '꽃이나 씨앗 변화는 며칠에서 몇 주 동안 기다리며 볼 수 있어요.',
    },
    edibleInfo: {
      edible: false,
      teacherCheckRequired: true,
      caution: '먹기보다 관찰하는 식물로 보는 게 좋아요.',
    },
    speciesFacts: {
      flowerExistence: '봉선화는 잘 자라면 꽃을 보여줄 수 있어.',
      fruitExistence: '봉선화는 꽃 뒤에 씨앗 주머니가 생길 수 있어.',
      colorInfo:
        '봉선화는 꽃이 분홍, 빨강, 하양처럼 여러 색으로 보일 수 있어. 잎은 보통 초록색이야.',
      ediblePartInfo: '봉선화는 먹는 부분을 찾기보다 꽃과 씨앗 변화를 관찰하는 식물로 보는 게 좋아.',
      hungryInfo: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
    },
    observationPoints: ['잎', '줄기', '꽃', '씨앗 주머니'],
    observationTips: ['꽃이 생기는지 줄기 가까이를 자세히 봐요.', '꽃이 진 자리도 관찰해 봐요.'],
    likelyFeatures: ['꽃이 필 수 있어요.', '꽃 뒤에 씨앗이 생길 수도 있어요.'],
    childQuestions: [
      {
        key: 'water',
        label: '물 필요해?',
        baseAnswer: '봉선화는 흙이 너무 마르지 않게 도와주면 좋아.',
        observePrompt: '내 흙을 먼저 살펴봐 줘.',
        condition: 'always',
      },
      {
        key: 'sunlight',
        label: '햇빛 좋아해?',
        baseAnswer: '나는 밝은 곳을 좋아하는 편이야.',
        observePrompt: '내 자리가 너무 어둡지 않은지 같이 볼래?',
        condition: 'always',
      },
      {
        key: 'flower',
        label: '꽃이 필까?',
        baseAnswer: '잘 자라면 예쁜 꽃이 필 수도 있어.',
        observePrompt: '줄기 가까운 곳을 자세히 봐 줄래?',
        condition: 'always',
      },
      {
        key: 'nextStage',
        label: '꽃 다음엔 뭐가 생길까?',
        baseAnswer: '꽃이 지나면 씨앗이 생길 수도 있어.',
        observePrompt: '꽃이 진 자리도 잘 봐 줘.',
        condition: 'hasFlower',
      },
      {
        key: 'drooping',
        label: '왜 축 처졌어?',
        baseAnswer: '물이 부족하거나 힘이 없으면 잎이 처질 수도 있어.',
        observePrompt: '내 잎과 흙을 같이 살펴봐 줘.',
        condition: 'hasDroopingLeaves',
      },
      {
        key: 'edible',
        label: '먹어도 돼?',
        baseAnswer: '봉선화는 먹기보다 관찰하는 식물로 보는 게 좋아.',
        observePrompt: '꽃과 줄기 변화를 관찰하는 데 더 집중해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'ediblePart',
        label: '뭘 먹어?',
        baseAnswer: '봉선화는 먹는 부분을 찾기보다 꽃과 씨앗 변화를 관찰하는 식물이야.',
        observePrompt: '꽃과 줄기 변화를 같이 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'harvest',
        label: '언제 먹을 수 있어?',
        baseAnswer: '봉선화는 먹는 시기를 말하기보다 관찰하는 식물로 보는 게 좋아.',
        observePrompt: '꽃과 씨앗 변화를 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'size',
        label: '얼마나 더 커?',
        baseAnswer: '줄기와 잎이 더 자라고 꽃 변화도 이어질 수 있어.',
        observePrompt: '오늘 줄기 길이와 다음 모습을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'growthTime',
        label: '얼마나 더 걸려?',
        baseAnswer: '꽃이나 씨앗 변화는 조금 기다리며 관찰하면 좋아.',
        observePrompt: '오늘과 다음 주 모습을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'color',
        label: '무슨 색이야?',
        baseAnswer: '봉선화는 꽃이 여러 색으로 보일 수 있고 잎은 보통 초록색이야.',
        observePrompt: '우리 식물은 지금 어떤 색인지 같이 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'flowerExist',
        label: '너도 꽃이 있어?',
        baseAnswer: '봉선화는 잘 자라면 꽃을 보여줄 수 있어.',
        observePrompt: '줄기 가까운 곳에 작은 변화가 있는지 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'fruitExist',
        label: '너도 열매가 있어?',
        baseAnswer: '봉선화는 꽃 뒤에 씨앗 주머니가 생길 수 있어.',
        observePrompt: '꽃이 진 자리도 같이 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'hungry',
        label: '배고파?',
        baseAnswer: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
        observePrompt: '내 흙과 빛 상태를 같이 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
    ],
    fallbackAnswers: {
      unknown: '그건 아직 확실하지 않아. 우리 같이 더 관찰해 보자.',
      observeMore: '꽃이나 줄기 쪽을 자세히 보면 힌트를 찾을 수 있을지도 몰라.',
    },
  },
  {
    key: 'tomato',
    label: '방울토마토',
    emoji: '🍅',
    shortDescription: '꽃과 열매가 자라는 모습을 보기 좋은 식물이에요.',
    basicInfo: {
      description: '방울토마토는 꽃과 열매 색 변화를 관찰하기 좋은 식물이에요.',
      mainParts: ['잎', '줄기', '꽃', '열매'],
    },
    care: {
      water: '흙이 바짝 마르기 전에 살펴보면 좋아요.',
      sunlight: '햇빛을 좋아하는 식물이에요.',
    },
    growthInfo: {
      speedHint: '꽃이 피고 열매 색이 바뀌는 모습을 차례로 볼 수 있어요.',
      sizeHint: '줄기와 열매가 조금씩 더 자라고 색 변화도 이어질 수 있어요.',
      growthTimeHint: '꽃, 열매, 색 변화는 며칠에서 몇 주 동안 기다리며 볼 수 있어요.',
    },
    edibleInfo: {
      edible: true,
      edibleParts: ['열매'],
      harvestHint: '열매가 충분히 자라고 색이 달라졌는지 보고 정하면 좋아요.',
      teacherCheckRequired: true,
      caution: '먹기 전에는 꼭 선생님이 먼저 확인해요.',
    },
    speciesFacts: {
      flowerExistence: '방울토마토는 꽃을 보여줄 수 있고, 그 뒤에 열매 변화가 이어질 수 있어.',
      fruitExistence: '방울토마토는 꽃 뒤에 열매가 생길 수 있어.',
      colorInfo:
        '방울토마토는 열매가 처음엔 초록색이고 자라며 붉거나 주황빛으로 달라질 수 있어. 꽃은 노란색으로 보일 수 있어.',
      ediblePartInfo: '방울토마토는 주로 열매를 먹는 식물로 알려져 있어.',
      hungryInfo: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
    },
    observationPoints: ['꽃', '열매', '열매 색', '줄기', '잎'],
    observationTips: ['꽃이 진 자리에서 열매가 생기는지 봐요.', '열매 색이 어떻게 달라지는지 비교해 봐요.'],
    likelyFeatures: ['꽃 뒤에 열매가 생길 수 있어요.', '열매 색이 달라질 수 있어요.'],
    childQuestions: [
      {
        key: 'water',
        label: '물 필요해?',
        baseAnswer: '방울토마토는 흙 상태를 보며 물이 필요한지 살펴보면 좋아.',
        observePrompt: '내 흙이 어떤지 다시 볼래?',
        condition: 'always',
      },
      {
        key: 'sunlight',
        label: '햇빛 좋아해?',
        baseAnswer: '나는 햇빛을 좋아하는 식물이야.',
        observePrompt: '내 자리가 밝은지도 같이 확인해 줄래?',
        condition: 'always',
      },
      {
        key: 'flower',
        label: '꽃이 왜 필요해?',
        baseAnswer: '꽃이 먼저 보이고, 그다음 열매가 생길 수도 있어.',
        observePrompt: '꽃이 있는 자리도 살펴봐 줘.',
        condition: 'always',
      },
      {
        key: 'fruit',
        label: '열매가 생길까?',
        baseAnswer: '꽃이 지나면 열매가 생길 수도 있어.',
        observePrompt: '꽃이 있던 자리와 줄기 근처를 같이 볼래?',
        condition: 'always',
      },
      {
        key: 'nextStage',
        label: '꽃 다음엔 뭐가 생길까?',
        baseAnswer: '꽃 다음에는 열매가 자랄 수도 있어.',
        observePrompt: '꽃이 진 자리도 잘 찾아봐 줘.',
        condition: 'hasFlower',
      },
      {
        key: 'ripeFruit',
        label: '언제 빨개질까?',
        baseAnswer: '열매는 자라면서 색이 달라질 수도 있어.',
        observePrompt: '열매 색을 어제와 오늘 비교해 볼래?',
        condition: 'hasFruit',
      },
      {
        key: 'drooping',
        label: '왜 축 처졌어?',
        baseAnswer: '물이 부족하거나 더 지쳤을 때 잎이 처질 수도 있어.',
        observePrompt: '내 흙과 잎을 같이 확인해 줘.',
        condition: 'hasDroopingLeaves',
      },
      {
        key: 'edible',
        label: '먹어도 돼?',
        baseAnswer: '방울토마토는 먹는 식물로 많이 알려져 있어.',
        observePrompt: '먹기 전에는 꼭 선생님이 먼저 확인해 줘.',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'ediblePart',
        label: '뭘 먹어?',
        baseAnswer: '방울토마토는 주로 열매를 먹는 식물로 알려져 있어.',
        observePrompt: '잎보다 열매를 먼저 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'harvest',
        label: '언제 먹을 수 있어?',
        baseAnswer: '열매가 충분히 자라고 색이 달라졌는지 보고 정하면 좋아.',
        observePrompt: '열매 색을 먼저 자세히 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'size',
        label: '얼마나 더 커?',
        baseAnswer: '줄기와 열매가 조금 더 자라고 색 변화도 이어질 수 있어.',
        observePrompt: '줄기 높이와 열매 크기를 같이 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'growthTime',
        label: '얼마나 더 걸려?',
        baseAnswer: '꽃, 열매, 색 변화는 조금 기다리며 지켜보면 좋아.',
        observePrompt: '며칠 뒤 열매 색을 다시 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'color',
        label: '무슨 색이야?',
        baseAnswer: '방울토마토는 초록색 열매가 자라며 붉거나 주황빛으로 달라질 수 있어.',
        observePrompt: '지금 우리 열매 색은 어떤지 같이 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'flowerExist',
        label: '너도 꽃이 있어?',
        baseAnswer: '방울토마토는 꽃을 보여줄 수 있어.',
        observePrompt: '꽃이 달린 줄기 쪽을 같이 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'fruitExist',
        label: '너도 열매가 있어?',
        baseAnswer: '방울토마토는 꽃 뒤에 열매가 생길 수 있어.',
        observePrompt: '열매가 있는지 줄기 가까이를 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'hungry',
        label: '배고파?',
        baseAnswer: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
        observePrompt: '물과 빛 상태를 같이 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
    ],
    fallbackAnswers: {
      unknown: '그건 아직 딱 말하기 어려워. 오늘 내 열매와 꽃을 같이 살펴보자.',
      observeMore: '꽃, 열매, 잎을 차례로 보면 더 잘 알 수 있어.',
    },
  },
  {
    key: 'kidneyBean',
    label: '강낭콩',
    emoji: '🫘',
    shortDescription: '새싹, 줄기, 잎이 자라는 변화를 보기 좋은 식물이에요.',
    basicInfo: {
      description: '강낭콩은 새싹, 줄기, 잎, 꼬투리 변화를 관찰하기 좋은 식물이에요.',
      mainParts: ['새싹', '줄기', '잎', '꽃', '꼬투리'],
    },
    care: {
      water: '흙이 너무 바짝 마르지 않게 보면 좋아요.',
      sunlight: '밝은 햇빛을 좋아해요.',
    },
    growthInfo: {
      speedHint: '줄기와 잎 변화가 눈에 비교적 잘 보이는 편이에요.',
      sizeHint: '줄기가 길어지고 잎이 더 자라며 나중엔 꼬투리 변화가 생길 수도 있어요.',
      growthTimeHint: '줄기와 잎은 비교적 빨리 변할 수 있고, 꽃과 꼬투리는 더 기다리며 봐야 해요.',
    },
    edibleInfo: {
      edible: true,
      edibleParts: ['콩', '꼬투리'],
      harvestHint: '먹는 상태인지 바로 정하기보다 선생님과 함께 확인해요.',
      teacherCheckRequired: true,
      caution: '관찰만 하고 바로 먹지 않아요.',
    },
    speciesFacts: {
      flowerExistence: '강낭콩은 잘 자라면 꽃을 볼 수도 있어.',
      fruitExistence: '강낭콩은 꽃 뒤에 꼬투리 같은 열매가 생길 수 있어.',
      colorInfo: '강낭콩은 잎은 보통 초록색이고 꽃과 꼬투리 변화가 이어질 수 있어.',
      ediblePartInfo:
        '강낭콩은 콩이나 꼬투리를 먹는 식물로 알려져 있지만, 바로 먹기 전엔 꼭 확인이 필요해.',
      hungryInfo: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
    },
    observationPoints: ['새싹', '줄기', '잎', '꼬투리'],
    observationTips: ['줄기가 얼마나 길어졌는지 살펴봐요.', '꽃이 피고 꼬투리가 생기는지 기다려 봐요.'],
    likelyFeatures: ['줄기가 길어질 수 있어요.', '나중에 꼬투리가 생길 수도 있어요.'],
    childQuestions: [
      {
        key: 'water',
        label: '물 필요해?',
        baseAnswer: '강낭콩은 흙 상태를 자주 보면 물이 필요한지 알 수 있어.',
        observePrompt: '흙 색과 촉촉함을 같이 봐 줄래?',
        condition: 'always',
      },
      {
        key: 'growth',
        label: '왜 줄기가 길어져?',
        baseAnswer: '강낭콩은 자라면서 줄기가 길어질 수 있어.',
        observePrompt: '줄기가 어디까지 자랐는지 찾아볼래?',
        condition: 'always',
      },
      {
        key: 'sunlight',
        label: '햇빛 좋아해?',
        baseAnswer: '나는 밝은 곳을 좋아하는 편이야.',
        observePrompt: '내 자리가 밝은지도 같이 볼래?',
        condition: 'always',
      },
      {
        key: 'flower',
        label: '꽃이 필까?',
        baseAnswer: '잘 자라면 꽃이 보일 수도 있어.',
        observePrompt: '줄기와 잎 사이를 잘 봐 줘.',
        condition: 'always',
      },
      {
        key: 'fruit',
        label: '열매가 생길까?',
        baseAnswer: '꽃이 지나면 꼬투리 같은 열매가 생길 수도 있어.',
        observePrompt: '꽃이 있던 자리도 다시 봐 줄래?',
        condition: 'hasFlower',
      },
      {
        key: 'newLeaf',
        label: '새 잎이 더 날까?',
        baseAnswer: '새 잎이 더 나올 수도 있어.',
        observePrompt: '연한 색 잎이 있는지 같이 볼래?',
        condition: 'hasNewLeaf',
      },
      {
        key: 'edible',
        label: '먹어도 돼?',
        baseAnswer: '강낭콩은 먹는 식물로 알려져 있지만 바로 먹기 전엔 확인이 필요해.',
        observePrompt: '선생님과 같이 상태를 먼저 살펴봐 줘.',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'ediblePart',
        label: '뭘 먹어?',
        baseAnswer: '강낭콩은 콩이나 꼬투리를 먹는 식물로 알려져 있어.',
        observePrompt: '먹는 부분인지 선생님과 같이 확인해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'harvest',
        label: '언제 먹을 수 있어?',
        baseAnswer: '먹는 시기는 식물 상태를 더 보고 선생님과 함께 정하는 게 좋아.',
        observePrompt: '꽃, 꼬투리, 콩 변화를 차례로 관찰해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'size',
        label: '얼마나 더 커?',
        baseAnswer: '줄기와 잎이 더 자라고 나중엔 꼬투리 변화도 볼 수 있어.',
        observePrompt: '줄기 길이와 잎 수를 같이 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'growthTime',
        label: '얼마나 더 걸려?',
        baseAnswer: '줄기와 잎은 비교적 빨리 달라질 수 있고, 큰 변화는 더 기다릴 수도 있어.',
        observePrompt: '오늘 모습과 다음 기록을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'color',
        label: '무슨 색이야?',
        baseAnswer: '강낭콩은 잎은 보통 초록색이고 꽃과 꼬투리 변화가 이어질 수 있어.',
        observePrompt: '지금 잎 색과 줄기 색을 같이 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'flowerExist',
        label: '너도 꽃이 있어?',
        baseAnswer: '강낭콩은 잘 자라면 꽃을 볼 수도 있어.',
        observePrompt: '줄기와 잎 사이를 자세히 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'fruitExist',
        label: '너도 열매가 있어?',
        baseAnswer: '강낭콩은 꽃 뒤에 꼬투리 같은 열매가 생길 수 있어.',
        observePrompt: '꽃이 진 자리도 같이 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'hungry',
        label: '배고파?',
        baseAnswer: '나는 사람처럼 배고프다기보다 물, 햇빛, 흙이 더 중요해.',
        observePrompt: '흙과 빛 상태를 같이 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
    ],
    fallbackAnswers: {
      unknown: '그건 아직 잘 모르겠어. 줄기와 잎을 같이 보면 힌트가 있을지도 몰라.',
      observeMore: '내 줄기와 새 잎을 더 자세히 봐 줄래?',
    },
  },
  {
    key: 'scindapsus',
    label: '스킨답서스',
    emoji: '🪴',
    shortDescription: '실내에서 잎과 줄기 변화를 오래 관찰하기 좋은 식물이에요.',
    basicInfo: {
      description: '스킨답서스는 잎과 줄기 변화를 오래 관찰하기 좋은 실내 식물이에요.',
      mainParts: ['잎', '줄기', '새 잎'],
    },
    care: {
      water: '흙이 너무 오래 마르지 않게 살펴보면 좋아요.',
      sunlight: '밝은 곳을 좋아하지만 너무 강한 햇빛은 힘들 수 있어요.',
    },
    growthInfo: {
      speedHint: '천천히 새 잎과 줄기 변화를 보여주는 식물이에요.',
      sizeHint: '줄기가 길어지고 잎이 늘어나는 모습을 볼 수 있어요.',
      growthTimeHint: '실내에서 천천히 자라기 때문에 며칠, 몇 주씩 지켜보며 비교하면 좋아요.',
    },
    edibleInfo: {
      edible: false,
      teacherCheckRequired: true,
      caution: '먹는 식물이 아니라 관찰하는 식물로 보는 게 좋아요.',
    },
    speciesFacts: {
      flowerExistence: '스킨답서스는 교실에서 키울 때 꽃을 자주 보는 식물은 아니야.',
      fruitExistence: '스킨답서스는 열매보다 잎과 줄기 변화를 관찰하는 식물이야.',
      colorInfo: '스킨답서스는 초록색 잎에 연한 무늬가 섞여 보일 수 있어.',
      ediblePartInfo: '먹는 식물로 보지 않고 잎과 줄기를 관찰하는 식물로 보는 게 좋아.',
      hungryInfo: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
    },
    observationPoints: ['잎 색', '잎 크기', '새 잎', '줄기 길이', '잎 처짐'],
    observationTips: ['줄기가 얼마나 길어지는지 살펴봐요.', '새 잎이 나오는지 잎 사이를 들여다봐요.'],
    likelyFeatures: ['새 잎이 천천히 날 수 있어요.', '줄기가 길어지며 자랄 수 있어요.'],
    childQuestions: [
      {
        key: 'water',
        label: '물 필요해?',
        baseAnswer: '나는 흙이 너무 오래 마르지 않으면 좋아.',
        observePrompt: '화분 흙 표면을 같이 볼래?',
        condition: 'always',
      },
      {
        key: 'sunlight',
        label: '햇빛 좋아해?',
        baseAnswer: '밝은 곳을 좋아하지만 너무 뜨거운 햇빛은 힘들 수 있어.',
        observePrompt: '내 자리가 너무 어둡지 않은지도 봐 줘.',
        condition: 'always',
      },
      {
        key: 'stem',
        label: '왜 줄기가 길어져?',
        baseAnswer: '나는 줄기가 길어지면서 자랄 수 있어.',
        observePrompt: '줄기가 어디까지 자랐는지 볼래?',
        condition: 'always',
      },
      {
        key: 'growth',
        label: '새 잎이 나올까?',
        baseAnswer: '천천히 새 잎이 나올 수도 있어.',
        observePrompt: '잎 사이에 작은 변화가 있는지 볼래?',
        condition: 'always',
      },
      {
        key: 'drooping',
        label: '왜 축 처졌어?',
        baseAnswer: '물이나 빛 상태를 다시 살펴보면 좋을지도 몰라.',
        observePrompt: '내 잎과 흙을 같이 봐 줄래?',
        condition: 'hasDroopingLeaves',
      },
      {
        key: 'leafColor',
        label: '왜 잎 색이 달라?',
        baseAnswer: '잎 색은 빛이나 물 상태에 따라 달라 보일 수도 있어.',
        observePrompt: '다른 잎과 색을 비교해 볼래?',
        condition: 'yellowLeaf',
      },
      {
        key: 'edible',
        label: '먹어도 돼?',
        baseAnswer: '스킨답서스는 먹는 식물이 아니라 관찰하는 식물로 보는 게 좋아.',
        observePrompt: '먹기보다 내 잎과 줄기 변화를 살펴봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'ediblePart',
        label: '뭘 먹어?',
        baseAnswer: '스킨답서스는 먹는 부분을 찾기보다 잎과 줄기를 관찰하는 식물이야.',
        observePrompt: '내 잎 색과 줄기 길이를 같이 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'harvest',
        label: '언제 먹을 수 있어?',
        baseAnswer: '스킨답서스는 먹는 시기를 말하기보다 관찰하는 식물로 보는 게 좋아.',
        observePrompt: '새 잎과 줄기 변화를 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'size',
        label: '얼마나 더 커?',
        baseAnswer: '줄기가 길어지고 잎이 더 늘어나는 변화를 볼 수 있어.',
        observePrompt: '오늘 줄기 길이와 다음 기록을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'growthTime',
        label: '얼마나 더 걸려?',
        baseAnswer: '스킨답서스는 천천히 자라기 때문에 며칠, 몇 주씩 지켜보며 비교하면 좋아.',
        observePrompt: '오늘 모습과 다음 모습을 비교해 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'color',
        label: '무슨 색이야?',
        baseAnswer: '스킨답서스는 초록색 잎에 연한 무늬가 섞여 보일 수 있어.',
        observePrompt: '잎 무늬와 색을 같이 볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'flowerExist',
        label: '너도 꽃이 있어?',
        baseAnswer: '스킨답서스는 교실에서 키울 때 꽃을 자주 보는 식물은 아니야.',
        observePrompt: '꽃보다 잎과 줄기 변화를 더 잘 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'fruitExist',
        label: '너도 열매가 있어?',
        baseAnswer: '스킨답서스는 열매보다 잎과 줄기 변화를 관찰하는 식물이야.',
        observePrompt: '잎과 줄기 쪽을 더 자세히 봐 줄래?',
        condition: 'always',
        visibleInButtons: false,
      },
      {
        key: 'hungry',
        label: '배고파?',
        baseAnswer: '나는 사람처럼 밥을 먹기보다 물, 햇빛, 흙이 더 중요해.',
        observePrompt: '흙과 빛 상태를 같이 살펴볼래?',
        condition: 'always',
        visibleInButtons: false,
      },
    ],
    fallbackAnswers: {
      unknown: '그건 아직 잘 모르겠어. 내 잎과 줄기를 같이 살펴보자.',
      observeMore: '내 잎 색과 흙 상태를 다시 보면 답을 찾을 수도 있어.',
    },
  },
];

export const plantSpeciesPresetMap: Record<PlantSpeciesKey, PlantSpeciesPreset> =
  Object.fromEntries(
    plantSpeciesPresets.map((preset) => [preset.key, preset])
  ) as Record<PlantSpeciesKey, PlantSpeciesPreset>;

export function getPlantSpeciesPreset(speciesKey?: PlantSpeciesKey) {
  if (!speciesKey) return undefined;
  return plantSpeciesPresetMap[speciesKey];
}

export function getPlantQuestionPreset(
  speciesKey: PlantSpeciesKey | undefined,
  questionKey: string
): PlantChildQuestionPreset | undefined {
  const preset = getPlantSpeciesPreset(speciesKey);
  if (!preset) return undefined;

  return preset.childQuestions.find((question) => question.key === questionKey);
}

function matchesQuestionCondition(
  condition: PlantChildQuestionPreset['condition'],
  latestRecord?: DailyPlantRecord
) {
  if (condition === 'always') return true;
  if (!latestRecord) return false;

  const { status } = latestRecord;

  if (condition === 'hasFlower') return status.hasFlower;
  if (condition === 'hasFruit') return status.hasFruit;
  if (condition === 'hasDroopingLeaves') return status.hasDroopingLeaves;
  if (condition === 'hasNewLeaf') return status.hasNewLeaf;
  if (condition === 'drySoil') return status.soilState === 'dry';
  if (condition === 'yellowLeaf') {
    return status.leafColor === 'yellow' || status.leafColor === 'brown';
  }

  return false;
}

export function getPlantQuestionOptions(
  speciesKey?: PlantSpeciesKey,
  latestRecord?: DailyPlantRecord
) {
  const preset = getPlantSpeciesPreset(speciesKey);
  if (!preset) return [];

  return preset.childQuestions
    .filter((question) => question.visibleInButtons !== false)
    .filter((question) => matchesQuestionCondition(question.condition, latestRecord))
    .map((question) => ({
      key: question.key,
      label: question.label,
    }));
}
