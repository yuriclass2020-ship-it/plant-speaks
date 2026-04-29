import type { Plant } from '../types/plant';
import type { DailyPlantRecord } from '../types/record';
import { getPlantSpeciesPreset } from '../data/plantSpeciesPresets';

type PlantListProps = {
  plants: Plant[];
  records: DailyPlantRecord[];
  selectedPlantId: string;
  onSelectPlant: (plantId: string) => void;
  onDeletePlant: (plantId: string) => void;
  getLatestRecord: (
    records: DailyPlantRecord[],
    plantId: string
  ) => DailyPlantRecord | undefined;
};

function PlantList({
  plants,
  records,
  selectedPlantId,
  onSelectPlant,
  onDeletePlant,
  getLatestRecord,
}: PlantListProps) {
  return (
    <section className="section-card">
      <h2 className="section-title">등록된 식물</h2>

      {plants.length === 0 ? (
        <p className="empty-text">아직 등록된 식물이 없어요.</p>
      ) : (
        <div className="card-grid">
          {plants.map((plant, index) => {
            const latestRecord = getLatestRecord(records, plant.id);
            const isSelected = selectedPlantId === plant.id;
            const plantRecordCount = records.filter(
              (record) => record.plantId === plant.id
            ).length;
            const speciesPreset = getPlantSpeciesPreset(plant.speciesKey);

            return (
              <div
                key={plant.id}
                className={isSelected ? 'plant-card plant-card-selected' : 'plant-card'}
              >
                <div className="card-name">
                  {index + 1}. {plant.name}
                </div>

                <div className="card-text">
                  식물 종류:{' '}
                  {speciesPreset
                    ? `${speciesPreset.emoji} ${speciesPreset.label}`
                    : '선택 안 됨'}
                </div>

                <div className="card-text">
                  반 이름: {plant.classroomName ?? '입력 없음'}
                </div>

                <div className="card-text-small">
                  누적 기록 수: {plantRecordCount}개
                </div>

                <div className="card-text-small">
                  최근 한마디: {latestRecord?.todayMessage ?? '아직 기록이 없어요.'}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPlant(plant.id)}
                    className="secondary-button"
                  >
                    이 식물 선택하기
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeletePlant(plant.id)}
                    style={{
                      width: '100%',
                      minHeight: 56,
                      fontSize: 18,
                      padding: '14px 16px',
                      borderRadius: 18,
                      border: 'none',
                      background: '#f4d7d7',
                      color: '#7a3d3d',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default PlantList;
