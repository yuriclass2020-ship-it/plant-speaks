import { Link, useParams } from 'react-router-dom-dom';
import QuestionSection from '../components/QuestionSection';
import type { Plant } from '../types/plant';
import type { PlantQuestionAnswer } from '../types/chat';

type PlantQuestionsPageProps = {
  plants: Plant[];
  conversations: PlantQuestionAnswer[];
  onAskQuestion: (plantId: string, questionKey: string, questionText: string) => void;
};

const questionOptions = [
  { key: 'thirsty', label: '목말라?' },
  { key: 'mood', label: '오늘 기분 어때?' },
  { key: 'compare', label: '아까보다 어때?' },
  { key: 'flower', label: '꽃은 언제 필까?' },
];

function PlantQuestionsPage({
  plants,
  conversations,
  onAskQuestion,
}: PlantQuestionsPageProps) {
  const params = useParams();
  const plantId = params.plantId ?? '';
  const selectedPlant = plants.find((plant) => plant.id === plantId);

  const selectedPlantConversations = conversations
    .filter((conversation) => conversation.plantId === plantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  if (!selectedPlant) {
    return (
      <section className="section-card">
        <h2 className="section-title">식물에게 질문하기</h2>
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
        <div style={{ display: 'grid', gap: 10 }}>
          <Link
            to={`/plants/${plantId}`}
            className="secondary-button"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            상세 보기로 돌아가기
          </Link>
        </div>
      </div>

      <QuestionSection
        selectedPlant={selectedPlant}
        questionOptions={questionOptions}
        selectedPlantConversations={selectedPlantConversations}
        onAskQuestion={(questionKey, questionText) =>
          onAskQuestion(plantId, questionKey, questionText)
        }
      />
    </>
  );
}

export default PlantQuestionsPage;
