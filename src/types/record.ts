export type WaterLevel = 'low' | 'normal' | 'high';
export type LeafColor = 'good' | 'yellow' | 'brown';
export type SoilState = 'dry' | 'normal' | 'wet';
export type PlantMood = 'happy' | 'okay' | 'thirsty' | 'tired';

export type RecordSource = 'child' | 'teacher';
export type ReviewStatus = 'child-only' | 'teacher-reviewed';

export type PlantPhoto = {
  id: string;
  imageUrl: string;
  takenAt: string;
};

export type VoiceMemo = {
  audioDataUrl: string;
  recordedAt: string;
};

export type PlantStatusSnapshot = {
  waterLevel: WaterLevel;
  leafColor: LeafColor;
  soilState: SoilState;
  hasNewLeaf: boolean;
  hasFlower: boolean;
  hasFruit: boolean;
  hasDroopingLeaves: boolean;
};

export type DailyPlantRecord = {
  id: string;
  plantId: string;
  dateKey: string;
  recorderName?: string;
  photos: PlantPhoto[];
  voiceMemo?: VoiceMemo;
  status: PlantStatusSnapshot;
  teacherMemo?: string;
  todayMessage: string;
  comparisonMessage: string;
  generatedMood: PlantMood;
  createdAt: string;
  updatedAt: string;
  recordSource: RecordSource;
  reviewStatus: ReviewStatus;
};
