import OpenAI from 'openai';
import {
  authorizeAiRequest,
  getPublicOpenAiError,
  getRequestOpenAiApiKey,
  logOpenAiError,
} from '../lib/api-security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }

  const authorization = await authorizeAiRequest(req, res, {
    kind: 'tts',
    maxBodyBytes: 2 * 1024,
  });
  if (!authorization) return;

  const apiKey = getRequestOpenAiApiKey(req);
  if (!apiKey) {
    return res.status(400).json({
      ok: false,
      code: 'USER_API_KEY_REQUIRED',
      error: '교사 또는 보호자의 OpenAI API 키를 입력해 주세요.',
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const mp3 = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: text.trim().slice(0, 300),
      instructions: [
        'Speak in Korean.',
        'Use a calm, gentle, friendly plant friend voice for young children.',
        'Keep the same pitch, pace, volume, emotion, and energy every time.',
        'Speak clearly at a natural, lightly brisk pace for young children.',
        'Do not sound like a robot, announcer, or serious adult.',
        'Avoid dramatic acting or exaggerated cuteness.',
        'Finish the entire sentence without trailing off.',
      ].join(' '),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioBase64 = buffer.toString('base64');
    return res.json({ ok: true, audioBase64 });
  } catch (error) {
    logOpenAiError('TTS error', error);
    const publicError = getPublicOpenAiError(
      error,
      '읽어주기 음성을 만들지 못했어요.'
    );
    return res.status(publicError.status).json({ ok: false, ...publicError });
  }
}
