import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { dbPath, getAppState, saveAppState } from './db.js';

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const ttsCache = new Map();

function buildTtsInstructions() {
  return [
    'Speak in Korean.',
    'Sound bright, playful, warm, and friendly.',
    'Sound like a cheerful young friend talking to a child.',
    'Keep the tone soft and encouraging, not formal.',
    'Use a slightly lively pace and upbeat intonation.',
    'Do not sound like an announcer or a serious adult.',
  ].join(' ');
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  return new OpenAI({ apiKey });
}

async function generateTtsAudioBase64(text) {
  const openai = getOpenAIClient();

  const response = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'marin',
    input: text,
    instructions: buildTtsInstructions(),
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'TTS server is running',
    database: dbPath,
  });
});

app.get('/api/state', (_req, res) => {
  try {
    res.json({
      ok: true,
      state: getAppState(),
    });
  } catch (error) {
    console.error('DB read error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to read app state';

    res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.put('/api/state', (req, res) => {
  try {
    const nextState = saveAppState(req.body?.state ?? {});

    res.json({
      ok: true,
      state: nextState,
    });
  } catch (error) {
    console.error('DB write error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to save app state';

    res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body ?? {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'text is required',
      });
    }

    const normalizedText = text.trim();

    if (!normalizedText) {
      return res.status(400).json({
        ok: false,
        error: 'text is empty',
      });
    }

    const cacheKey = normalizedText;

    if (ttsCache.has(cacheKey)) {
      return res.json({
        ok: true,
        mockMode: false,
        cached: true,
        audioBase64: ttsCache.get(cacheKey),
      });
    }

    const audioBase64 = await generateTtsAudioBase64(normalizedText);

    ttsCache.set(cacheKey, audioBase64);

    return res.json({
      ok: true,
      mockMode: false,
      cached: false,
      audioBase64,
    });
  } catch (error) {
    console.error('TTS error:', error);

    const message =
      error instanceof Error ? error.message : 'failed to generate speech';

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`TTS server listening on http://localhost:${PORT}`);
});
