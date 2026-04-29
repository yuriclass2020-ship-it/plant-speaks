import { useMemo, useState, type CSSProperties } from 'react';
import type { Plant } from '../types/plant';
import type { DailyPlantRecord } from '../types/record';

type RecordHistoryProps = {
  records: DailyPlantRecord[];
  plants: Plant[];
  formatDateTime: (isoString: string) => string;
};

type HistoryFilter =
  | 'all'
  | 'today'
  | 'child-pending'
  | 'child-all'
  | 'teacher';

function getPlantName(plants: Plant[], plantId: string) {
  return plants.find((plant) => plant.id === plantId)?.name ?? '이름 없는 식물';
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecordBadges(record: DailyPlantRecord) {
  const badges: Array<{ label: string; background: string; color: string }> = [];

  if (record.recordSource === 'teacher') {
    badges.push({ label: '교사 작성', background: '#e8f1ff', color: '#2251cc' });
  } else if (record.reviewStatus === 'teacher-reviewed') {
    badges.push({ label: '아이 기록', background: '#fff4d6', color: '#8a5a00' });
    badges.push({ label: '교사 보완 완료', background: '#e7f8ee', color: '#147a42' });
  } else {
    badges.push({ label: '아이 기록', background: '#fff4d6', color: '#8a5a00' });
    badges.push({ label: '교사 확인 전', background: '#ffe8e8', color: '#b42318' });
  }

  if (record.voiceMemo) {
    badges.push({ label: '음성 메모', background: '#f3e8ff', color: '#7c3aed' });
  }

  return badges;
}

function matchesFilter(record: DailyPlantRecord, filter: HistoryFilter, todayKey: string) {
  if (filter === 'all') return true;
  if (filter === 'today') return record.dateKey === todayKey;
  if (filter === 'child-pending') {
    return record.recordSource === 'child' && record.reviewStatus === 'child-only';
  }
  if (filter === 'child-all') return record.recordSource === 'child';
  if (filter === 'teacher') return record.recordSource === 'teacher';
  return true;
}

function filterLabel(filter: HistoryFilter) {
  if (filter === 'all') return '전체';
  if (filter === 'today') return '오늘 기록';
  if (filter === 'child-pending') return '교사 확인 전';
  if (filter === 'child-all') return '아이 기록';
  return '교사 작성';
}

function RecordHistory({ records, plants, formatDateTime }: RecordHistoryProps) {
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>('all');
  const [selectedPlantId, setSelectedPlantId] = useState('all');

  const todayKey = getTodayKey();

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return sortedRecords.filter((record) => {
      const matchesHistoryFilter = matchesFilter(record, selectedFilter, todayKey);
      const matchesPlantFilter =
        selectedPlantId === 'all' ? true : record.plantId === selectedPlantId;

      return matchesHistoryFilter && matchesPlantFilter;
    });
  }, [sortedRecords, selectedFilter, selectedPlantId, todayKey]);

  const counts = useMemo(() => {
    return {
      all: records.length,
      today: records.filter((record) => record.dateKey === todayKey).length,
      childPending: records.filter(
        (record) =>
          record.recordSource === 'child' && record.reviewStatus === 'child-only'
      ).length,
      childAll: records.filter((record) => record.recordSource === 'child').length,
      teacher: records.filter((record) => record.recordSource === 'teacher').length,
    };
  }, [records, todayKey]);

  const filterButtonStyle = (isActive: boolean): CSSProperties => ({
    minHeight: 44,
    borderRadius: 12,
    border: 'none',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    background: isActive ? '#2f6fed' : '#eef2ff',
    color: isActive ? '#ffffff' : '#334155',
  });

  return (
    <section className="section-card">
      <h2 className="section-title">전체 기록</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          style={filterButtonStyle(selectedFilter === 'all')}
          onClick={() => setSelectedFilter('all')}
        >
          전체 ({counts.all})
        </button>

        <button
          type="button"
          style={filterButtonStyle(selectedFilter === 'today')}
          onClick={() => setSelectedFilter('today')}
        >
          오늘 기록 ({counts.today})
        </button>

        <button
          type="button"
          style={filterButtonStyle(selectedFilter === 'child-pending')}
          onClick={() => setSelectedFilter('child-pending')}
        >
          교사 확인 전 ({counts.childPending})
        </button>

        <button
          type="button"
          style={filterButtonStyle(selectedFilter === 'child-all')}
          onClick={() => setSelectedFilter('child-all')}
        >
          아이 기록 ({counts.childAll})
        </button>

        <button
          type="button"
          style={filterButtonStyle(selectedFilter === 'teacher')}
          onClick={() => setSelectedFilter('teacher')}
        >
          교사 작성 ({counts.teacher})
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <label className="form-label" htmlFor="historyPlantFilter">
          식물별 보기
        </label>

        <select
          id="historyPlantFilter"
          className="form-input"
          value={selectedPlantId}
          onChange={(e) => setSelectedPlantId(e.target.value)}
        >
          <option value="all">전체 식물</option>
          {plants.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
      </div>

      <div className="summary-box" style={{ marginBottom: 18 }}>
        <div className="summary-title">현재 보기</div>
        <div className="card-text">
          {filterLabel(selectedFilter)}
          {selectedPlantId !== 'all'
            ? ` · ${getPlantName(plants, selectedPlantId)}`
            : ''}
        </div>
        <div className="card-text">총 {filteredRecords.length}건</div>
      </div>

      {filteredRecords.length === 0 ? (
        <p className="empty-text">조건에 맞는 기록이 없어요.</p>
      ) : (
        <div className="card-grid">
          {filteredRecords.map((record) => (
            <div key={record.id} className="record-card">
              <div className="summary-title" style={{ marginBottom: 8 }}>
                {getPlantName(plants, record.plantId)}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div className="card-text">{formatDateTime(record.updatedAt)}</div>

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

              <div className="card-text" style={{ marginTop: 8 }}>
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default RecordHistory;
