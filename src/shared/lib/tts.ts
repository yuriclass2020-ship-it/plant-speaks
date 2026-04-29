export type TtsResponse = {
  ok: boolean;
  mockMode?: boolean;
  cached?: boolean;
  audioBase64?: string;
  error?: string;
};

const TTS_SERVER_URL = 'http://localhost:8787/api/tts';

export async function requestTts(text: string): Promise<TtsResponse> {
  const response = await fetch(TTS_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = (await response.json()) as TtsResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? '음성 생성에 실패했어요.');
  }

  return data;
}

export function base64ToAudioSrc(audioBase64: string) {
  if (!audioBase64) return '';
  return `data:audio/mp3;base64,${audioBase64}`;
}
