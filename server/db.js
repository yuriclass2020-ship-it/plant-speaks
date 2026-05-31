import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'plant-speaks.sqlite');
const MAX_CHAT_MESSAGES = 80;
const DEFAULT_GROUP_ID = 'default';

function normalizeGroupId(groupId) {
  const normalized = String(groupId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || DEFAULT_GROUP_ID;
}

function groupKey(groupId, key) {
  return `${normalizeGroupId(groupId)}:${key}`;
}

function plantIdForGroup(groupId) {
  return `${normalizeGroupId(groupId)}:main`;
}

function recordIdPrefixForGroup(groupId) {
  return `${normalizeGroupId(groupId)}:`;
}

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

  CREATE TABLE IF NOT EXISTS group_care_state (
    group_id TEXT PRIMARY KEY,
    water_goal INTEGER NOT NULL,
    sun_goal INTEGER NOT NULL,
    water_count INTEGER NOT NULL,
    sun_count INTEGER NOT NULL,
    water_interval_days INTEGER,
    last_watered_date_key TEXT,
    count_date_key TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    sort_order INTEGER,
    child_name TEXT,
    plant_name TEXT,
    plant_type TEXT,
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
    photo_analysis_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
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

for (const statement of [
  'ALTER TABLE plants ADD COLUMN teacher_info_json TEXT',
  'ALTER TABLE care_state ADD COLUMN water_interval_days INTEGER',
  'ALTER TABLE care_state ADD COLUMN last_watered_date_key TEXT',
  'ALTER TABLE care_state ADD COLUMN count_date_key TEXT',
  'ALTER TABLE records ADD COLUMN sort_order INTEGER',
  'ALTER TABLE records ADD COLUMN child_name TEXT',
  'ALTER TABLE records ADD COLUMN plant_name TEXT',
  'ALTER TABLE records ADD COLUMN plant_type TEXT',
  'ALTER TABLE records ADD COLUMN photo_analysis_json TEXT',
]) {
  try {
    db.exec(statement);
  } catch (error) {
    if (!String(error?.message ?? '').includes('duplicate column name')) {
      throw error;
    }
  }
}

const defaultCareState = {
  waterGoal: 1,
  sunGoal: 1,
  waterCount: 0,
  sunCount: 0,
  waterIntervalDays: 2,
  lastWateredDateKey: '',
  countDateKey: '',
};

function nowIso() {
  return new Date().toISOString();
}

function rowToPlant(row) {
  if (!row) return null;
  let teacherInfo;

  if (row.teacher_info_json) {
    try {
      teacherInfo = JSON.parse(row.teacher_info_json);
    } catch {
      teacherInfo = undefined;
    }
  }

  return {
    name: row.name,
    type: row.type,
    memo: row.memo,
    teacherInfo,
  };
}

function rowToRecord(row) {
  let photoAnalysis;

  if (row.photo_analysis_json) {
    try {
      photoAnalysis = JSON.parse(row.photo_analysis_json);
    } catch {
      photoAnalysis = undefined;
    }
  }

  return {
    id: row.id,
    childName: row.child_name ?? undefined,
    plantName: row.plant_name ?? undefined,
    plantType: row.plant_type ?? undefined,
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
    photoAnalysis,
  };
}

function stripRecordIdPrefix(recordId, groupId) {
  const id = String(recordId ?? '');
  const prefix = recordIdPrefixForGroup(groupId);

  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

function getMetaJson(key, fallback) {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);

  if (!row?.value) return fallback;

  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function setMetaJson(key, value, timestamp) {
  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value), timestamp);
}

export function getUsageCount(kind, dateKey) {
  const value = getMetaJson(`usage:${dateKey}:${kind}`, 0);
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function incrementUsageCount(kind, dateKey) {
  const timestamp = nowIso();
  const nextCount = getUsageCount(kind, dateKey) + 1;
  setMetaJson(`usage:${dateKey}:${kind}`, nextCount, timestamp);
  return nextCount;
}

function getCareState(groupId = DEFAULT_GROUP_ID) {
  const row = db
    .prepare(
      `SELECT water_goal, sun_goal, water_count, sun_count,
              water_interval_days, last_watered_date_key, count_date_key
       FROM group_care_state
       WHERE group_id = ?`
    )
    .get(normalizeGroupId(groupId));

  if (!row) return defaultCareState;

  return {
    waterGoal: row.water_goal,
    sunGoal: row.sun_goal,
    waterCount: row.water_count,
    sunCount: row.sun_count,
    waterIntervalDays:
      row.water_interval_days ?? defaultCareState.waterIntervalDays,
    lastWateredDateKey:
      row.last_watered_date_key ?? defaultCareState.lastWateredDateKey,
    countDateKey: row.count_date_key ?? defaultCareState.countDateKey,
  };
}

export function getAppState(groupId = DEFAULT_GROUP_ID) {
  const normalizedGroupId = normalizeGroupId(groupId);
  const plant = db
    .prepare('SELECT * FROM plants WHERE id = ?')
    .get(plantIdForGroup(normalizedGroupId));
  const records = db
    .prepare(
      `SELECT * FROM records
       WHERE id LIKE ?
       ORDER BY COALESCE(sort_order, 999999) ASC, created_at DESC`
    )
    .all(`${recordIdPrefixForGroup(normalizedGroupId)}%`)
    .map((row) => {
      const record = rowToRecord(row);

      return {
        ...record,
        id: stripRecordIdPrefix(record.id, normalizedGroupId),
      };
    });

  return {
    plant: rowToPlant(plant),
    careState: getCareState(normalizedGroupId),
    records,
    chatMessages: getMetaJson(groupKey(normalizedGroupId, 'chatMessages'), []),
    childRoster: getMetaJson(groupKey(normalizedGroupId, 'childRoster'), []),
    currentChildName: getMetaJson(groupKey(normalizedGroupId, 'currentChildName'), ''),
  };
}

export function saveAppState(state, groupId = DEFAULT_GROUP_ID) {
  const normalizedGroupId = normalizeGroupId(groupId);
  const timestamp = nowIso();
  const careState = {
    ...defaultCareState,
    ...(state?.careState ?? {}),
  };
  const records = Array.isArray(state?.records) ? state.records : [];
  const chatMessages = Array.isArray(state?.chatMessages)
    ? state.chatMessages.slice(-MAX_CHAT_MESSAGES)
    : [];
  const childRoster = Array.isArray(state?.childRoster) ? state.childRoster : [];
  const currentChildName =
    typeof state?.currentChildName === 'string' ? state.currentChildName : '';

  db.exec('BEGIN');

  try {
    if (state?.plant) {
      db.prepare(
        `INSERT INTO plants (
           id, name, type, memo, teacher_info_json, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           memo = excluded.memo,
           teacher_info_json = excluded.teacher_info_json,
           updated_at = excluded.updated_at`
      ).run(
        plantIdForGroup(normalizedGroupId),
        state.plant.name ?? '',
        state.plant.type ?? '',
        state.plant.memo ?? '',
        state.plant.teacherInfo ? JSON.stringify(state.plant.teacherInfo) : null,
        timestamp,
        timestamp
      );
    } else {
      db.prepare('DELETE FROM plants WHERE id = ?').run(
        plantIdForGroup(normalizedGroupId)
      );
    }

    db.prepare(
      `INSERT INTO group_care_state (
        group_id, water_goal, sun_goal, water_count, sun_count,
        water_interval_days, last_watered_date_key, count_date_key, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(group_id) DO UPDATE SET
         water_goal = excluded.water_goal,
         sun_goal = excluded.sun_goal,
         water_count = excluded.water_count,
         sun_count = excluded.sun_count,
         water_interval_days = excluded.water_interval_days,
         last_watered_date_key = excluded.last_watered_date_key,
         count_date_key = excluded.count_date_key,
         updated_at = excluded.updated_at`
    ).run(
      normalizedGroupId,
      careState.waterGoal,
      careState.sunGoal,
      careState.waterCount,
      careState.sunCount,
      careState.waterIntervalDays,
      careState.lastWateredDateKey,
      careState.countDateKey,
      timestamp
    );

    db.prepare('DELETE FROM records WHERE id LIKE ?').run(
      `${recordIdPrefixForGroup(normalizedGroupId)}%`
    );

    const insertRecord = db.prepare(
      `INSERT INTO records (
        id, sort_order, child_name, plant_name, plant_type,
        type, title, date, date_key, first_label, first_value, first_icon,
        second_label, second_value, second_icon, memo, image_data,
        photo_analysis_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    records.forEach((record, index) => {
      insertRecord.run(
        `${recordIdPrefixForGroup(normalizedGroupId)}${record.id}`,
        index,
        record.childName ?? null,
        record.plantName ?? null,
        record.plantType ?? null,
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
        record.photoAnalysis ? JSON.stringify(record.photoAnalysis) : null,
        timestamp,
        timestamp
      );
    });

    setMetaJson(groupKey(normalizedGroupId, 'chatMessages'), chatMessages, timestamp);
    setMetaJson(groupKey(normalizedGroupId, 'childRoster'), childRoster, timestamp);
    setMetaJson(
      groupKey(normalizedGroupId, 'currentChildName'),
      currentChildName,
      timestamp
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAppState(normalizedGroupId);
}

export function resetAppState(groupId = DEFAULT_GROUP_ID) {
  const normalizedGroupId = normalizeGroupId(groupId);
  const timestamp = nowIso();

  db.exec('BEGIN');

  try {
    db.prepare('DELETE FROM records WHERE id LIKE ?').run(
      `${recordIdPrefixForGroup(normalizedGroupId)}%`
    );
    db.prepare('DELETE FROM plants WHERE id = ?').run(
      plantIdForGroup(normalizedGroupId)
    );
    db.prepare('DELETE FROM group_care_state WHERE group_id = ?').run(
      normalizedGroupId
    );
    db.prepare("DELETE FROM app_meta WHERE key LIKE ? AND key NOT LIKE 'usage:%'").run(
      `${normalizedGroupId}:%`
    );

    db.prepare(
      `INSERT INTO group_care_state (
         group_id, water_goal, sun_goal, water_count, sun_count,
         water_interval_days, last_watered_date_key, count_date_key,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      normalizedGroupId,
      defaultCareState.waterGoal,
      defaultCareState.sunGoal,
      defaultCareState.waterCount,
      defaultCareState.sunCount,
      defaultCareState.waterIntervalDays,
      defaultCareState.lastWateredDateKey,
      defaultCareState.countDateKey,
      timestamp
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAppState(normalizedGroupId);
}

export { dbPath };
