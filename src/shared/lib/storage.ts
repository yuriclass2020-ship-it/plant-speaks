import type { Plant } from '../../types/plant';
import type { DailyPlantRecord } from '../../types/record';
import type { PlantQuestionAnswer } from '../../types/chat';

const STORAGE_KEY = 'plant-speaks.v1';

export interface AppState {
  plants: Plant[];
  records: DailyPlantRecord[];
  conversations: PlantQuestionAnswer[];
}

export function createInitialState(): AppState {
  return {
    plants: [],
    records: [],
    conversations: [],
  };
}

export function loadAppState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;

    return {
      plants: parsed.plants ?? [],
      records: parsed.records ?? [],
      conversations: parsed.conversations ?? [],
    };
  } catch {
    return createInitialState();
  }
}

export function saveAppState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
