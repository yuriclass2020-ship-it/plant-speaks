import type { ChangeEventHandler, FormEventHandler } from 'react';
import type { Plant } from '../types/plant';
import type { LeafColor, SoilState } from '../types/record';
import type { PhotoSuggestion } from '../shared/lib/imageAnalysis';

type RecordFormProps = {
  selectedPlant?: Plant;
  photoPreview: string | null;
  fileInputKey: number;
  recorderName: string;
  soilState: SoilState;
  leafColor: LeafColor;
  hasNewLeaf: boolean;
  hasFlower: boolean;
  hasFruit: boolean;
  hasDroopingLeaves: boolean;
  teacherMemo: string;
  autoSuggestion: PhotoSuggestion | null;
  isEditing?: boolean;
  onPhotoChange: ChangeEventHandler<HTMLInputElement>;
  onRecorderNameChange: (value: string) => void;
  onSoilStateChange: (value: SoilState) => void;
  onLeafColorChange: (value: LeafColor) => void;
  onHasNewLeafChange: (value: boolean) => void;
  onHasFlowerChange: (value: boolean) => void;
  onHasFruitChange: (value: boolean) => void;
  onHasDroopingLeavesChange: (value: boolean) => void;
  onTeacherMemoChange: (value: string) => void;
  onApplySuggestion: () => void;
  onCancelEdit?: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

const leafColorLabelMap: Record<LeafColor, string> = {
  good: '초록색이에요',
  pale: '조금 연해요',
  yellow: '노란빛이 있어요',
  brown: '갈색 부분이 있어요',
};

function RecordForm({
  selectedPlant,
  photoPreview,
  fileInputKey,
  recorderName,
  soilState,
  leafColor,
  hasNewLeaf,
  hasFlower,
  hasFruit,
  hasDroopingLeaves,
  teacherMemo,
  autoSuggestion,
  isEditing = false,
  onPhotoChange,
  onRecorderNameChange,
  onSoilStateChange,
  onLeafColorChange,
  onHasNewLeafChange,
  onHasFlowerChange,
  onHasFruitChange,
  onHasDroopingLeavesChange,
  onTeacherMemoChange,
  onApplySuggestion,
  onCancelEdit,
  onSubmit,
}: RecordFormProps) {
  return (
    <section className="section-card">
      <h2 className="section-title">
        {isEditing ? '기록 수정하기' : '오늘 기록 작성'}
      </h2>

      {!selectedPlant ? (
        <p className="empty-text">위에서 식물을 먼저 선택해 주세요.</p>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="card-name">선택한 식물: {selectedPlant.name}</div>

          <div className="form-field">
            <label htmlFor="recorderName" className="form-label">
              기록한 사람 이름
            </label>
            <input
              id="recorderName"
              type="text"
              value={recorderName}
              onChange={(e) => onRecorderNameChange(e.target.value)}
              placeholder="예: 민서, 지우, 햇살반 1조"
              className="form-input"
            />
          </div>

          <div className="form-field-large">
            <label htmlFor="photo" className="form-label">
              오늘 사진
            </label>
            <input
              key={fileInputKey}
              id="photo"
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              className="file-input"
            />

            {photoPreview && (
              <img src={photoPreview} alt="업로드 미리보기" className="preview-image" />
            )}
          </div>

          {autoSuggestion && (
            <div className="suggestion-box">
              <div className="suggestion-title">사진 기반 자동 제안</div>

              <div className="suggestion-text">
                추천 잎 색: {leafColorLabelMap[autoSuggestion.recommendedLeafColor]}
              </div>

              <div className="suggestion-text">
                자동 판단: {autoSuggestion.summary}
              </div>

              <div className="suggestion-guide">
                촬영 안내: {autoSuggestion.photoGuide}
              </div>

              <div className="suggestion-meta">
                신뢰도: {autoSuggestion.confidence === 'medium' ? '보통' : '낮음'}
              </div>

              <button type="button" onClick={onApplySuggestion} className="warning-button">
                추천값 적용하기
              </button>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="soilState" className="form-label">
              흙 상태
            </label>
            <select
              id="soilState"
              value={soilState}
              onChange={(e) => onSoilStateChange(e.target.value as SoilState)}
              className="form-select"
            >
              <option value="dry">말라 있어요</option>
              <option value="normal">보통이에요</option>
              <option value="wet">촉촉해요</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="leafColor" className="form-label">
              잎 색
            </label>
            <select
              id="leafColor"
              value={leafColor}
              onChange={(e) => onLeafColorChange(e.target.value as LeafColor)}
              className="form-select"
            >
              <option value="good">초록색이에요</option>
              <option value="pale">조금 연해요</option>
              <option value="yellow">노란빛이 있어요</option>
              <option value="brown">갈색 부분이 있어요</option>
            </select>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasNewLeaf}
                onChange={(e) => onHasNewLeafChange(e.target.checked)}
                className="checkbox-input"
              />
              새 잎이 보여요
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasFlower}
                onChange={(e) => onHasFlowerChange(e.target.checked)}
                className="checkbox-input"
              />
              꽃이 보여요
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasFruit}
                onChange={(e) => onHasFruitChange(e.target.checked)}
                className="checkbox-input"
              />
              열매가 보여요
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasDroopingLeaves}
                onChange={(e) => onHasDroopingLeavesChange(e.target.checked)}
                className="checkbox-input"
              />
              잎이 축 처졌어요
            </label>
          </div>

          <div className="form-field-large">
            <label htmlFor="teacherMemo" className="form-label">
              교사 메모
            </label>
            <textarea
              id="teacherMemo"
              value={teacherMemo}
              onChange={(e) => onTeacherMemoChange(e.target.value)}
              placeholder="예: 아이가 열매를 먼저 발견했어요."
              rows={4}
              className="form-textarea"
            />
          </div>

          {isEditing ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={onCancelEdit}
              >
                수정 취소
              </button>
              <button type="submit" className="primary-button">
                수정 저장하기
              </button>
            </div>
          ) : (
            <button type="submit" className="primary-button">
              오늘 기록 저장하기
            </button>
          )}
        </form>
      )}
    </section>
  );
}

export default RecordForm;
