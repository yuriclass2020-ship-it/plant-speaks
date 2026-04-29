export type PlantId = string;

export interface Plant {
  id: PlantId;
  name: string;
  species?: string;
  createdAt: string;
  avatarImage?: string;
  classroomName?: string;
  note?: string;
}
