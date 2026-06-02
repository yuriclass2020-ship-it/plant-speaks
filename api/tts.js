import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',  // 더 밝고 친근한 목소리
      input: text.trim().slice(0, 300),
      speed: 0.85,       // 느리게 — 아이들이 듣기 편하게
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioBase64 = buffer.toString('base64');
    return res.json({ ok: true, audioBase64 });
  } catch (error) {
    console.error('TTS error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to generate speech' });
  }
}
