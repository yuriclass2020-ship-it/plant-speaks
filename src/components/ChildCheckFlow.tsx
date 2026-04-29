import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Plant } from '../types/plant';
import type { LeafColor, SoilState } from '../types/record';

export type ChildCheckResult = {
  recorderName: string;
  soilState: SoilState;
  leafColor: LeafColor;
  hasNewLeaf: boolean;
  hasFlower: boolean;
  hasFruit: boolean;
  hasDroopingLeaves: boolean;
  voiceMemoDataUrl: string | null;
};

type ChildCheckFlowProps = {
  selectedPlant: Plant;
  onComplete: (result: ChildCheckResult) => void;
  onCancel: () => void;
};

const initialChildCheck: ChildCheckResult = {
  recorderName: '',
  soilState: 'normal',
  leafColor: 'good',
  hasNewLeaf: false,
  hasFlower: false,
  hasFruit: false,
  hasDroopingLeaves: false,
  voiceMemoDataUrl: null,
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('음성 변환에 실패했어요.'));
      }
    };

    reader.onerror = () => reject(new Error('음성 파일을 읽지 못했어요.'));
    reader.readAsDataURL(blob);
  });
}

function ChildCheckFlow({
  selectedPlant,
  onComplete,
  onCancel,
}: ChildCheckFlowProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ChildCheckResult>(initialChildCheck);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [isAudioSupported, setIsAudioSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== 'undefined';

    setIsAudioSupported(supported);

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const goNext = () => setStep((prev) => Math.min(prev + 1, 7));
  const goPrev = () => setStep((prev) => Math.max(prev - 1, 0));

  const resetFlow = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingError('');
    setForm(initialChildCheck);
    setStep(0);
  };

  const startRecording = async () => {
    try {
      setRecordingError('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || 'audio/webm',
          });

          if (audioBlob.size > 0) {
            const audioDataUrl = await blobToDataUrl(audioBlob);
            setForm((prev) => ({ ...prev, voiceMemoDataUrl: audioDataUrl }));
          }
        } catch {
          setRecordingError('음성 메모를 저장하지 못했어요.');
        } finally {
          setIsRecording(false);

          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setRecordingError('마이크 권한이 필요하거나 녹음을 시작할 수 없어요.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const removeVoiceMemo = () => {
    setForm((prev) => ({ ...prev, voiceMemoDataUrl: null }));
    setRecordingError('');
  };

  const finishMessage = (() => {
    if (form.hasFruit) {
      return `${selectedPlant.name}가 열매를 보여줬어! 오늘 정말 잘 관찰했어.`;
    }

    if (form.hasFlower) {
      return `${selectedPlant.name}에 꽃이 보여서 정말 반가워!`;
    }

    if (form.hasNewLeaf) {
      return `${selectedPlant.name}가 새 잎을 보여줬어! 쑥쑥 자라고 있나 봐.`;
    }

    if (form.soilState === 'dry') {
      return `${selectedPlant.name} 흙이 말라 보였어. 물이 필요한지 선생님과 같이 봐 보자.`;
    }

    if (form.hasDroopingLeaves) {
      return `${selectedPlant.name} 잎이 조금 축 처져 보였어. 오늘 잘 살펴봐 줘서 고마워.`;
    }

    if (form.leafColor === 'yellow' || form.leafColor === 'brown') {
      return `${selectedPlant.name} 잎 색이 조금 달라 보여. 다음에도 같이 잘 살펴보자.`;
    }

    return `${selectedPlant.name}를 오늘도 자세히 봐줘서 고마워!`;
  })();

  const largeButtonStyle: CSSProperties = {
    minHeight: 72,
    fontSize: 18,
    fontWeight: 700,
  };

  const optionGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    marginTop: 16,
  };

  return (
    <section className="section-card">
      <h2 className="section-title">아이와 함께 체크하기</h2>

      <div className="summary-box" style={{ marginBottom: 16 }}>
        <div className="summary-title">{selectedPlant.name}</div>
        <div className="card-text">
          한 번에 하나씩 보고, 큰 버튼으로 체크하면 돼.
        </div>
      </div>

      {step === 0 && (
        <>
          <label htmlFor="childName" className="form-label">
            누가 관찰했어?
          </label>
          <input
            id="childName"
            className="form-input"
            type="text"
            value={form.recorderName}
            placeholder="이름을 적어도 되고, 비워도 괜찮아"
            onChange={(e) =>
              setForm((prev) => ({ ...prev, recorderName: e.target.value }))
            }
          />

          <div style={optionGridStyle}>
            <button
              type="button"
              className="primary-button"
              style={largeButtonStyle}
              onClick={goNext}
            >
              다음
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={onCancel}
            >
              나가기
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="summary-title">흙은 어때?</div>

          <div style={optionGridStyle}>
            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, soilState: 'dry' }));
                goNext();
              }}
            >
              말랐어
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, soilState: 'normal' }));
                goNext();
              }}
            >
              괜찮아
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, soilState: 'wet' }));
                goNext();
              }}
            >
              촉촉해
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="summary-title">잎 색은 어때?</div>

          <div style={optionGridStyle}>
            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, leafColor: 'good' }));
                goNext();
              }}
            >
              초록이야
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, leafColor: 'yellow' }));
                goNext();
              }}
            >
              노래
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, leafColor: 'brown' }));
                goNext();
              }}
            >
              갈색이 보여
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="summary-title">새 잎이 보여?</div>

          <div style={optionGridStyle}>
            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasNewLeaf: true }));
                goNext();
              }}
            >
              응
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasNewLeaf: false }));
                goNext();
              }}
            >
              아니
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="summary-title">꽃이 보여?</div>

          <div style={optionGridStyle}>
            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasFlower: true }));
                goNext();
              }}
            >
              응
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasFlower: false }));
                goNext();
              }}
            >
              아니
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div className="summary-title">열매나 꼬투리가 보여?</div>

          <div style={optionGridStyle}>
            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasFruit: true }));
                goNext();
              }}
            >
              응
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasFruit: false }));
                goNext();
              }}
            >
              아니
            </button>
          </div>
        </>
      )}

      {step === 6 && (
        <>
          <div className="summary-title">잎이 축 처졌어?</div>

          <div style={optionGridStyle}>
            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasDroopingLeaves: true }));
                goNext();
              }}
            >
              응
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={() => {
                setForm((prev) => ({ ...prev, hasDroopingLeaves: false }));
                goNext();
              }}
            >
              아니
            </button>
          </div>
        </>
      )}

      {step === 7 && (
        <>
          <div className="summary-box" style={{ marginBottom: 16 }}>
            <div className="summary-title">식물 한마디</div>
            <div className="card-text">{finishMessage}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div className="card-text">관찰자: {form.recorderName || '이름 없음'}</div>
            <div className="card-text">
              흙: {form.soilState === 'dry' ? '말랐어' : form.soilState === 'wet' ? '촉촉해' : '괜찮아'}
            </div>
            <div className="card-text">
              잎 색:{' '}
              {form.leafColor === 'good'
                ? '초록이야'
                : form.leafColor === 'yellow'
                ? '노래'
                : '갈색이 보여'}
            </div>
          </div>

          <div className="summary-box" style={{ marginBottom: 16 }}>
            <div className="summary-title">음성 메모 남기기</div>
            <div className="card-text" style={{ marginBottom: 12 }}>
              하고 싶은 말을 짧게 남길 수 있어. 예: "오늘 꽃이 있었어요."
            </div>

            {!isAudioSupported && (
              <div className="card-text">
                이 브라우저에서는 음성 녹음이 지원되지 않아요.
              </div>
            )}

            {isAudioSupported && (
              <>
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
                    className="secondary-button"
                    style={{ minHeight: 56, fontSize: 16 }}
                    onClick={startRecording}
                    disabled={isRecording}
                  >
                    {isRecording ? '녹음 중...' : '녹음 시작'}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    style={{ minHeight: 56, fontSize: 16 }}
                    onClick={stopRecording}
                    disabled={!isRecording}
                  >
                    녹음 멈추기
                  </button>
                </div>

                {recordingError && (
                  <div className="card-text" style={{ color: '#b42318', marginBottom: 12 }}>
                    {recordingError}
                  </div>
                )}

                {form.voiceMemoDataUrl && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <audio controls src={form.voiceMemoDataUrl} style={{ width: '100%' }} />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={removeVoiceMemo}
                    >
                      음성 메모 삭제
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={optionGridStyle}>
            <button
              type="button"
              className="primary-button"
              style={largeButtonStyle}
              onClick={() => onComplete(form)}
            >
              기록 저장하기
            </button>

            <button
              type="button"
              className="secondary-button"
              style={largeButtonStyle}
              onClick={resetFlow}
            >
              처음부터 다시
            </button>
          </div>
        </>
      )}

      {step > 0 && step < 7 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: 56, fontSize: 16 }}
            onClick={goPrev}
          >
            이전
          </button>

          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: 56, fontSize: 16 }}
            onClick={onCancel}
          >
            나가기
          </button>
        </div>
      )}
    </section>
  );
}

export default ChildCheckFlow;
