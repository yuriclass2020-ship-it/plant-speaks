import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plant } from '../types/plant';
import type { PlantQuestionAnswer } from '../types/chat';
import { base64ToAudioSrc, requestTts } from '../shared/lib/tts';

type QuestionOption = {
  key: string;
  label: string;
};

type QuestionSectionProps = {
  selectedPlant: Plant;
  questionOptions: QuestionOption[];
  selectedPlantConversations: PlantQuestionAnswer[];
  onAskQuestion: (questionKey: string, questionText: string) => void;
  onAskFreeQuestion: (questionText: string) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
    isFinal?: boolean;
    length: number;
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function chooseFriendlyKoreanVoice(voices: SpeechSynthesisVoice[]) {
  const koreanVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('ko')
  );

  if (koreanVoices.length === 0) {
    return undefined;
  }

  const preferredKeywords = [
    'female',
    'woman',
    'girl',
    'young',
    'natural',
    'friendly',
    '여성',
    '한국어',
    'korean',
    'google',
  ];

  const scored = koreanVoices.map((voice) => {
    const voiceName = `${voice.name} ${voice.lang}`.toLowerCase();

    let score = 0;

    preferredKeywords.forEach((keyword) => {
      if (voiceName.includes(keyword)) {
        score += 1;
      }
    });

    if (voice.lang.toLowerCase() === 'ko-kr') {
      score += 2;
    }

    if (voice.localService) {
      score += 1;
    }

    return { voice, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice;
}

function QuestionSection({
  selectedPlant,
  questionOptions,
  selectedPlantConversations,
  onAskQuestion,
  onAskFreeQuestion,
}: QuestionSectionProps) {
  const [freeQuestionText, setFreeQuestionText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [readingQuestionId, setReadingQuestionId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioUrlMap, setAudioUrlMap] = useState<Record<string, string>>({});
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSpeechSupported = useMemo(() => {
    return Boolean(
      typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }, []);

  const isBrowserTtsSupported = useMemo(() => {
    return Boolean(
      typeof window !== 'undefined' &&
        typeof window.speechSynthesis !== 'undefined' &&
        typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }, []);

  useEffect(() => {
    if (!isBrowserTtsSupported) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isBrowserTtsSupported]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const startVoiceInput = () => {
    if (!isSpeechSupported) {
      setSpeechError('이 브라우저에서는 음성 질문 기능이 지원되지 않아요.');
      return;
    }

    setSpeechError('');

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSpeechError('음성 질문 기능을 사용할 수 없어요.');
      return;
    }

    const beginRecognition = () => {
      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;

      recognition.lang = 'ko-KR';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? '')
          .join(' ')
          .trim();

        if (transcript) {
          setFreeQuestionText(transcript);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setSpeechError('마이크 권한을 허용해야 음성 질문을 쓸 수 있어요.');
        } else if (event.error === 'no-speech') {
          setSpeechError('말소리가 잘 들리지 않았어요. 다시 말해 주세요.');
        } else if (event.error === 'aborted') {
          // iOS Safari occasionally aborts — silently ignore
        } else {
          setSpeechError('음성 질문을 인식하지 못했어요. 다시 시도해 주세요.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      try {
        recognition.start();
      } catch {
        setSpeechError('녹음 시작에 실패했어요. 다시 시도해 주세요.');
        setIsListening(false);
      }
    };

    // iOS Safari requires getUserMedia to be called first so that the browser
    // properly activates the microphone permission before SpeechRecognition.start().
    if (navigator.mediaDevices?.getUserMedia) {
      setIsListening(true); // show feedback while waiting for permission
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          beginRecognition();
        })
        .catch((err: unknown) => {
          setIsListening(false);
          const name = err instanceof DOMException ? err.name : '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setSpeechError('마이크 권한을 허용해야 음성 질문을 쓸 수 있어요.');
          } else {
            // getUserMedia unavailable on this device — try recognition directly
            beginRecognition();
          }
        });
    } else {
      beginRecognition();
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleSubmitFreeQuestion = () => {
    const trimmed = freeQuestionText.trim();

    if (!trimmed) {
      alert('질문을 입력하거나 말해 주세요.');
      return;
    }

    onAskFreeQuestion(trimmed);
    setFreeQuestionText('');
    setSpeechError('');
  };

  const speakWithBrowserFallback = (conversation: PlantQuestionAnswer) => {
    if (!isBrowserTtsSupported) {
      alert('답변 읽어주기를 사용할 수 없어요.');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(conversation.answerText);
    utterance.lang = 'ko-KR';

    const friendlyVoice = chooseFriendlyKoreanVoice(availableVoices);
    if (friendlyVoice) {
      utterance.voice = friendlyVoice;
    }

    utterance.rate = 1.1;
    utterance.pitch = 1.35;
    utterance.volume = 1;

    utterance.onstart = () => {
      setReadingQuestionId(conversation.id);
    };

    utterance.onend = () => {
      setReadingQuestionId((prev) => (prev === conversation.id ? null : prev));
    };

    utterance.onerror = () => {
      setReadingQuestionId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleReadAnswer = async (conversation: PlantQuestionAnswer) => {
    alert('읽어주기 버튼 클릭됨');
    console.log('read button clicked', conversation.answerText);

    try {
      setLoadingAudioId(conversation.id);
      setSpeechError('');

      let audioUrl = audioUrlMap[conversation.id];
      console.log('cached audioUrl:', audioUrl);

      if (!audioUrl) {
        console.log('requestTts start');
        alert('서버에 음성 요청 보내기 시작');

        const result = await requestTts(conversation.answerText);

        console.log('tts result:', result);
        alert(`tts 응답 받음: mockMode=${String(result.mockMode)}`);

        if (result.mockMode || !result.audioBase64) {
          console.log('fallback to browser speech');
          alert('외부 음성 대신 브라우저 음성으로 넘어감');
          speakWithBrowserFallback(conversation);
          return;
        }

        audioUrl = base64ToAudioSrc(result.audioBase64);

        setAudioUrlMap((prev) => ({
          ...prev,
          [conversation.id]: audioUrl!,
        }));
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        console.log('audio play');
        setReadingQuestionId(conversation.id);
      };

      audio.onended = () => {
        console.log('audio ended');
        setReadingQuestionId((prev) => (prev === conversation.id ? null : prev));
      };

      audio.onerror = () => {
        console.log('audio error');
        setReadingQuestionId(null);
        setSpeechError('음성 재생에 실패했어요.');
      };

      await audio.play();
    } catch (error) {
      console.error('handleReadAnswer error:', error);
      alert(`에러 발생: ${String(error)}`);
      setSpeechError('음성 생성 요청에 실패했어요. 지금은 기본 읽어주기로 바꿔서 재생할게요.');
      speakWithBrowserFallback(conversation);
    } finally {
      setLoadingAudioId(null);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setReadingQuestionId(null);
    setLoadingAudioId(null);
  };

  return (
    <section className="section-card">
      <h2 className="section-title">식물에게 질문하기</h2>

      <div className="summary-box" style={{ marginBottom: 18 }}>
        <div className="summary-title">{selectedPlant.name}</div>
        <div className="card-text">
          버튼으로 묻거나, 직접 말한 질문도 보낼 수 있어.
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ fontSize: 20 }}>
          자주 하는 질문
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 12,
          }}
        >
          {questionOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className="secondary-button"
              style={{ minHeight: 56 }}
              onClick={() => onAskQuestion(option.key, option.label)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ fontSize: 20 }}>
          직접 질문하기
        </h3>

        <label htmlFor="freeQuestion" className="form-label">
          궁금한 것을 물어봐
        </label>
        <textarea
          id="freeQuestion"
          className="form-input"
          rows={4}
          value={freeQuestionText}
          placeholder="예: 너는 왜 잎이 노래?"
          onChange={(e) => setFreeQuestionText(e.target.value)}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 12,
          }}
        >
          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: 56 }}
            onClick={startVoiceInput}
            disabled={!isSpeechSupported || isListening}
          >
            {isListening ? '듣는 중...' : '🎤 말로 질문하기'}
          </button>

          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: 56 }}
            onClick={stopVoiceInput}
            disabled={!isListening}
          >
            듣기 멈추기
          </button>
        </div>

        {!isSpeechSupported && (
          <div className="card-text" style={{ marginTop: 10 }}>
            이 브라우저에서는 음성 질문이 지원되지 않아요.
          </div>
        )}

        {speechError && (
          <div
            className="card-text"
            style={{ marginTop: 10, color: '#b42318', fontWeight: 700 }}
          >
            {speechError}
          </div>
        )}

        <div className="card-text" style={{ marginTop: 10 }}>
          말한 뒤 텍스트가 맞는지 보고 질문 보내기를 누르면 돼.
        </div>

        <button
          type="button"
          className="primary-button"
          style={{ marginTop: 14, minHeight: 56, width: '100%' }}
          onClick={handleSubmitFreeQuestion}
        >
          질문 보내기
        </button>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h3 className="section-title" style={{ fontSize: 20, marginBottom: 0 }}>
            최근 질문 기록
          </h3>

          <button
            type="button"
            className="secondary-button"
            onClick={stopSpeaking}
            disabled={!readingQuestionId && !loadingAudioId}
          >
            읽기 멈추기
          </button>
        </div>

        {selectedPlantConversations.length === 0 ? (
          <p className="empty-text">아직 질문 기록이 없어요.</p>
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

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleReadAnswer(conversation)}
                    disabled={loadingAudioId === conversation.id}
                  >
                    {loadingAudioId === conversation.id
                      ? '음성 준비 중...'
                      : readingQuestionId === conversation.id
                      ? '읽는 중...'
                      : '🔊 답변 읽어주기'}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={stopSpeaking}
                    disabled={readingQuestionId !== conversation.id}
                  >
                    멈추기
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

export default QuestionSection;
