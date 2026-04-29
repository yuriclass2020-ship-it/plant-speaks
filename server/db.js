import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'plant-speaks.sqlite');

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    memo TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS care_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    water_goal INTEGER NOT NULL,
    sun_goal INTEGER NOT NULL,
    water_count INTEGER NOT NULL,
    sun_count INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    date_key TEXT,
    first_label TEXT NOT NULL,
    first_value TEXT NOT NULL,
    first_icon TEXT NOT NULL,
    second_label TEXT NOT NULL,
    second_value TEXT NOT NULL,
    second_icon TEXT NOT NULL,
    memo TEXT NOT NULL,
    image_data TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

try {
  db.exec('ALTER TABLE records ADD COLUMN date_key TEXT');
} catch (error) {
  if (!String(error?.message ?? '').includes('duplicate column name')) {
    throw error;
  }
}

const defaultCareState = {
  waterGoal: 1,
  sunGoal: 1,
  waterCount: 0,
  sunCount: 0,
};

function nowIso() {
  return new Date().toISOString();
}

function rowToPlant(row) {
  if (!row) return null;

  return {
    name: row.name,
    type: row.type,
    memo: row.memo,
  };
}

function rowToRecord(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    date: row.date,
    dateKey: row.date_key ?? '',
    firstLabel: row.first_label,
    firstValue: row.first_value,
    firstIcon: row.first_icon,
    secondLabel: row.second_label,
    secondValue: row.second_value,
    secondIcon: row.second_icon,
    memo: row.memo,
    imageData: row.image_data ?? undefined,
  };
}

function getCareState() {
  const row = db
    .prepare(
      `SELECT water_goal, sun_goal, water_count, sun_count
       FROM care_state
       WHERE id = 1`
    )
    .get();

  if (!row) return defaultCareState;

  return {
    waterGoal: row.water_goal,
    sunGoal: row.sun_goal,
    waterCount: row.water_count,
    sunCount: row.sun_count,
  };
}

export function getAppState() {
  const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get('main');
  const records = db
    .prepare('SELECT * FROM records ORDER BY created_at DESC')
    .all()
    .map(rowToRecord);

  return {
    plant: rowToPlant(plant),
    careState: getCareState(),
    records,
  };
}

export function saveAppState(state) {
  const timestamp = nowIso();
  const careState = {
    ...defaultCareState,
    ...(state?.careState ?? {}),
  };
  const records = Array.isArray(state?.records) ? state.records : [];

  db.exec('BEGIN');

  try {
    if (state?.plant) {
      db.prepare(
        `INSERT INTO plants (id, name, type, memo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           memo = excluded.memo,
           updated_at = excluded.updated_at`
      ).run(
        'main',
        state.plant.name ?? '',
        state.plant.type ?? '',
        state.plant.memo ?? '',
        timestamp,
        timestamp
      );
    } else {
      db.prepare('DELETE FROM plants WHERE id = ?').run('main');
    }

    db.prepare(
      `INSERT INTO care_state (
        id, water_goal, sun_goal, water_count, sun_count, updated_at
       )
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         water_goal = excluded.water_goal,
         sun_goal = excluded.sun_goal,
         water_count = excluded.water_count,
         sun_count = excluded.sun_count,
         updated_at = excluded.updated_at`
    ).run(
      careState.waterGoal,
      careState.sunGoal,
      careState.waterCount,
      careState.sunCount,
      timestamp
    );

    db.prepare('DELETE FROM records').run();

    const insertRecord = db.prepare(
      `INSERT INTO records (
        id, type, title, date, date_key, first_label, first_value, first_icon,
        second_label, second_value, second_icon, memo, image_data,
        created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const record of records) {
      insertRecord.run(
        record.id,
        record.type,
        record.title,
        record.date,
        record.dateKey ?? null,
        record.firstLabel,
        record.firstValue,
        record.firstIcon,
        record.secondLabel,
        record.secondValue,
        record.secondIcon,
        record.memo,
        record.imageData ?? null,
        timestamp,
        timestamp
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAppState();
}

export { dbPath };
