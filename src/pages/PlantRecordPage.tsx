import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom-dom';
import RecordForm from '../components/RecordForm';
import { analyzePlantPhoto, type PhotoSuggestion } from '../shared/lib/imageAnalysis';
import type { Plant } from '../types/plant';
import type { LeafColor, SoilState } from '../types/record';

type RecordFormState = {
  soilState: SoilState;
  leafColor: LeafColor;
  hasNewLeaf: boolean;
  hasFlower: boolean;
  hasDroopingLeaves: boolean;
  teacherMemo: string;
};

type PlantRecordPageProps = {
  plants: Plant[];
  onSaveRecord: (
    plantId: string,
    form: RecordFormState,
    photoPreview: string | null
  ) => void;
};

const initialRecordForm: RecordFormState = {
  soilState: 'normal',
  leafColor: 'good',
  hasNewLeaf: false,
  hasFlower: false,
  hasDroopingLeaves: false,
  teacherMemo: '',
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('이미지 변환에 실패했습니다.'));
      }
    };

    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

function PlantRecordPage({ plants, onSaveRecord }: PlantRecordPageProps) {
  const navigate = useNavigate();
  const params = useParams();
  const plantId = params.plantId ?? '';
  const selectedPlant = plants.find((plant) => plant.id === plantId);

  const [recordForm, setRecordForm] = useState<RecordFormState>(initialRecordForm);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [autoSuggestion, setAutoSuggestion] = useState<PhotoSuggestion | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    setRecordForm(initialRecordForm);
    setPhotoPreview(null);
    setAutoSuggestion(null);
    setFileInputKey((prev) => prev + 1);
  }, [plantId]);

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      setPhotoPreview(null);
      setAutoSuggestion(null);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoPreview(dataUrl);

      const suggestion = await analyzePlantPhoto(dataUrl);
      setAutoSuggestion(suggestion);
    } catch {
      setAutoSuggestion(null);
      alert('사진을 불러오지 못했어요.');
    }
  };

  const handleApplySuggestion = () => {
    if (!autoSuggestion) return;

    setRecordForm((prev) => ({
      ...prev,
      leafColor: autoSuggestion.recommendedLeafColor,
    }));

    alert('자동 제안이 잎 색에 반영됐어요. 다른 항목은 선생님이 확인해 주세요.');
  };

  if (!selectedPlant) {
    return (
      <section className="section-card">
        <h2 className="section-title">오늘의 기록 작성</h2>
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

      <RecordForm
        selectedPlant={selectedPlant}
        photoPreview={photoPreview}
        fileInputKey={fileInputKey}
        soilState={recordForm.soilState}
        leafColor={recordForm.leafColor}
        hasNewLeaf={recordForm.hasNewLeaf}
        hasFlower={recordForm.hasFlower}
        hasDroopingLeaves={recordForm.hasDroopingLeaves}
        teacherMemo={recordForm.teacherMemo}
        autoSuggestion={autoSuggestion}
        onPhotoChange={handlePhotoChange}
        onSoilStateChange={(value) =>
          setRecordForm((prev) => ({ ...prev, soilState: value }))
        }
        onLeafColorChange={(value) =>
          setRecordForm((prev) => ({ ...prev, leafColor: value }))
        }
        onHasNewLeafChange={(value) =>
          setRecordForm((prev) => ({ ...prev, hasNewLeaf: value }))
        }
        onHasFlowerChange={(value) =>
          setRecordForm((prev) => ({ ...prev, hasFlower: value }))
        }
        onHasDroopingLeavesChange={(value) =>
          setRecordForm((prev) => ({ ...prev, hasDroopingLeaves: value }))
        }
        onTeacherMemoChange={(value) =>
          setRecordForm((prev) => ({ ...prev, teacherMemo: value }))
        }
        onApplySuggestion={handleApplySuggestion}
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          onSaveRecord(plantId, recordForm, photoPreview);
          navigate(`/plants/${plantId}`);
        }}
      />
    </>
  );
}

export default PlantRecordPage;
