import { Link, useParams } from 'react-router-dom-dom';
import SelectedPlantDetail from '../components/SelectedPlantDetail';
import type { Plant } from '../types/plant';
import type { DailyPlantRecord } from '../types/record';
import type { PlantQuestionAnswer } from '../types/chat';

type PlantDetailPageProps = {
  plants: Plant[];
  records: DailyPlantRecord[];
  conversations: PlantQuestionAnswer[];
  formatDateTime: (isoString: string) => string;
};

function PlantDetailPage({
  plants,
  records,
  conversations,
  formatDateTime,
}: PlantDetailPageProps) {
  const params = useParams();
  const plantId = params.plantId ?? '';
  const selectedPlant = plants.find((plant) => plant.id === plantId);

  const selectedPlantRecords = records
    .filter((record) => record.plantId === plantId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const selectedPlantConversations = conversations
    .filter((conversation) => conversation.plantId === plantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!selectedPlant) {
    return (
      <section className="section-card">
        <h2 className="section-title">선택한 식물 상세보기</h2>
        <p className="empty-text" style={{ marginBottom: 16 }}>
          식물을 찾을 수 없어요.
        </p>
        <Link to="/plants" className="secondary-button" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
          식물 목록으로 가기
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="section-card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <Link
            to={`/plants/${plantId}/record`}
            className="primary-button"
            style={{ textDecoration: 'none', textAlign: 'center', minHeight: 56, padding: '14px 16px' }}
          >
            오늘의 기록 작성
          </Link>
          <Link
            to={`/plants/${plantId}/questions`}
            className="question-button"
            style={{ textDecoration: 'none', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            식물에게 질문하기
          </Link>
        </div>
      </div>

      <SelectedPlantDetail
        selectedPlant={selectedPlant}
        selectedPlantRecords={selectedPlantRecords}
        selectedPlantConversations={selectedPlantConversations}
        formatDateTime={formatDateTime}
      />
    </>
  );
}

export default PlantDetailPage;
