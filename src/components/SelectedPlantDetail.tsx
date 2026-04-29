import type { Plant } from '../types/plant';
import type { DailyPlantRecord } from '../types/record';
import type { PlantQuestionAnswer } from '../types/chat';

type SelectedPlantDetailProps = {
  selectedPlant: Plant;
  selectedPlantRecords: DailyPlantRecord[];
  selectedPlantConversations: PlantQuestionAnswer[];
  formatDateTime: (isoString: string) => string;
  onEditRecord: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
};

function getRecordBadges(record: DailyPlantRecord) {
  if (record.recordSource === 'teacher') {
    return [{ label: '교사 작성', background: '#e8f1ff', color: '#2251cc' }];
  }

  if (record.reviewStatus === 'teacher-reviewed') {
    return [
      { label: '아이 기록', background: '#fff4d6', color: '#8a5a00' },
      { label: '교사 보완 완료', background: '#e7f8ee', color: '#147a42' },
    ];
  }

  return [
    { label: '아이 기록', background: '#fff4d6', color: '#8a5a00' },
    { label: '교사 확인 전', background: '#ffe8e8', color: '#b42318' },
  ];
}

function SelectedPlantDetail({
  selectedPlant,
  selectedPlantRecords,
  selectedPlantConversations,
  formatDateTime,
  onEditRecord,
  onDeleteRecord,
  onDeleteConversation,
}: SelectedPlantDetailProps) {
  return (
    <section className="section-card">
      <h2 className="section-title">선택한 식물 상세보기</h2>

      <div className="summary-box" style={{ marginBottom: 20 }}>
        <div className="summary-title">{selectedPlant.name}</div>
        <div className="card-text">
          최근 기록과 질문 기록을 한 번에 볼 수 있어.
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ fontSize: 20 }}>
          기록
        </h3>

        {selectedPlantRecords.length === 0 ? (
          <p className="empty-text">아직 저장된 기록이 없어요.</p>
        ) : (
          <div className="card-grid">
            {selectedPlantRecords.map((record) => (
              <div key={record.id} className="record-card">
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <div className="summary-title" style={{ marginBottom: 0 }}>
                    {formatDateTime(record.updatedAt)}
                  </div>

                  {getRecordBadges(record).map((badge) => (
                    <span
                      key={`${record.id}-${badge.label}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: badge.background,
                        color: badge.color,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                {record.recorderName && (
                  <div className="card-text" style={{ marginBottom: 8 }}>
                    관찰자: {record.recorderName}
                  </div>
                )}

                <div className="card-text">오늘 한마디: {record.todayMessage}</div>
                <div className="card-text">비교: {record.comparisonMessage}</div>
                <div className="card-text">
                  흙 상태:{' '}
                  {record.status.soilState === 'dry'
                    ? '말랐어요'
                    : record.status.soilState === 'wet'
                    ? '촉촉해요'
                    : '보통이에요'}
                </div>
                <div className="card-text">
                  잎 색:{' '}
                  {record.status.leafColor === 'good'
                    ? '초록이에요'
                    : record.status.leafColor === 'yellow'
                    ? '노랗게 보여요'
                    : '갈색이 보여요'}
                </div>
                <div className="card-text">
                  새 잎: {record.status.hasNewLeaf ? '보임' : '안 보임'}
                </div>
                <div className="card-text">
                  꽃: {record.status.hasFlower ? '보임' : '안 보임'}
                </div>
                <div className="card-text">
                  열매/꼬투리: {record.status.hasFruit ? '보임' : '안 보임'}
                </div>
                <div className="card-text">
                  잎 처짐: {record.status.hasDroopingLeaves ? '있음' : '없음'}
                </div>

                {record.voiceMemo && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card-text" style={{ marginBottom: 8 }}>
                      음성 메모
                    </div>
                    <audio
                      controls
                      src={record.voiceMemo.audioDataUrl}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {record.teacherMemo && (
                  <div className="card-text" style={{ marginTop: 8 }}>
                    교사 메모: {record.teacherMemo}
                  </div>
                )}

                {record.photos.length > 0 && record.photos[0]?.imageUrl && (
                  <img
                    src={record.photos[0].imageUrl}
                    alt="식물 기록 사진"
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      marginTop: 12,
                      objectFit: 'cover',
                    }}
                  />
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onEditRecord(record.id)}
                  >
                    {record.recordSource === 'child' ? '보완하기' : '수정하기'}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onDeleteRecord(record.id)}
                  >
                    삭제하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="section-title" style={{ fontSize: 20 }}>
          질문 기록
        </h3>

        {selectedPlantConversations.length === 0 ? (
          <p className="empty-text">아직 질문한 기록이 없어요.</p>
        ) : (
          <div className="card-grid">
            {selectedPlantConversations.map((conversation) => (
              <div key={conversation.id} className="question-card">
                <div className="question-title">
                  질문: {conversation.questionText}
                </div>
                <div className="answer-text">
                  식물의 답: {conversation.answerText}
                </div>
                <div className="card-text" style={{ marginTop: 8 }}>
                  {formatDateTime(conversation.createdAt)}
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onDeleteConversation(conversation.id)}
                  >
                    질문 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default SelectedPlantDetail;
