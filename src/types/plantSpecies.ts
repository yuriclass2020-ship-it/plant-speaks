export type PlantSpeciesKey =
  | 'lettuce'
  | 'balsam'
  | 'tomato'
  | 'kidneyBean'
  | 'scindapsus';

export type PlantQuestionKey =
  | 'water'
  | 'sunlight'
  | 'growth'
  | 'flower'
  | 'fruit'
  | 'leafColor'
  | 'drooping'
  | 'stem'
  | 'help'
  | 'nextStage'
  | 'ripeFruit'
  | 'newLeaf'
  | 'edible'
  | 'ediblePart'
  | 'harvest'
  | 'size'
  | 'growthTime'
  | 'color'
  | 'flowerExist'
  | 'fruitExist'
  | 'hungry';

export type PlantQuestionCondition =
  | 'always'
  | 'hasFlower'
  | 'hasFruit'
  | 'hasDroopingLeaves'
  | 'hasNewLeaf'
  | 'drySoil'
  | 'yellowLeaf';

export interface PlantChildQuestionPreset {
  key: PlantQuestionKey;
  label: string;
  baseAnswer: string;
  alternativeAnswers?: string[];
  observePrompt: string;
  alternativePrompts?: string[];
  condition: PlantQuestionCondition;
  visibleInButtons?: boolean;
}

export interface PlantSpeciesPreset {
  key: PlantSpeciesKey;
  label: string;
  emoji: string;
  shortDescription: string;

  basicInfo: {
    description: string;
    mainParts: string[];
  };

  care: {
    water: string;
    sunlight: string;
  };

  growthInfo: {
    speedHint: string;
    sizeHint: string;
    growthTimeHint: string;
  };

  edibleInfo: {
    edible: boolean;
    edibleParts?: string[];
    harvestHint?: string;
    teacherCheckRequired: boolean;
    caution?: string;
  };

  speciesFacts: {
    flowerExistence: string;
    fruitExistence: string;
    colorInfo: string;
    ediblePartInfo: string;
    hungryInfo: string;
  };

  observationPoints: string[];
  observationTips: string[];
  likelyFeatures: string[];
  childQuestions: PlantChildQuestionPreset[];

  fallbackAnswers: {
    unknown: string;
    observeMore: string;
  };
}
