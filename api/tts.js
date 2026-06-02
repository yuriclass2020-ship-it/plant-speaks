export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GOOGLE_TTS_API_KEY not set' });
  }

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: text.trim().slice(0, 300) },
          voice: {
            languageCode: 'ko-KR',
            name: 'ko-KR-Neural2-A',  // 최고품질 한국어 여성 목소리
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.92,  // 살짝 느리게
            pitch: 0.0,          // 자연 그대로
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Google TTS error:', err);
      return res.status(500).json({ ok: false, error: 'Google TTS failed' });
    }

    const data = await response.json();
    const audioBase64 = data.audioContent;

    if (!audioBase64) {
      return res.status(500).json({ ok: false, error: 'No audio content' });
    }

    return res.json({ ok: true, audioBase64 });
  } catch (error) {
    console.error('TTS error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to generate speech' });
  }
}
