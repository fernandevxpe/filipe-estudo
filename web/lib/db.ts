import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let _db: Database.Database | null = null;

function ensureColumn(db: Database.Database, table: string, col: string, ddl: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!rows.some((r) => r.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const onVercel = Boolean(process.env.VERCEL);
  const dir = onVercel ? "/tmp" : path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "filipe.sqlite");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_log (
      day TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'perdido',
      target_questions INTEGER DEFAULT 0,
      done_questions INTEGER DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      pool_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      score REAL,
      total INTEGER,
      correct INTEGER
    );
    CREATE TABLE IF NOT EXISTS session_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      choice TEXT,
      correct_letter TEXT,
      is_correct INTEGER,
      time_ms INTEGER NOT NULL,
      evidence_type TEXT DEFAULT 'objective'
    );
    CREATE TABLE IF NOT EXISTS audit_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      kind TEXT,
      detail TEXT,
      created_at TEXT
    );
  `);
  ensureColumn(db, "session_answers", "area", "area TEXT");
  ensureColumn(db, "session_answers", "study_topic", "study_topic TEXT");
  ensureColumn(db, "session_answers", "skipped", "skipped INTEGER DEFAULT 0");
  ensureColumn(db, "session_answers", "source_pool_id", "source_pool_id TEXT");
  ensureColumn(db, "study_sessions", "session_kind", "session_kind TEXT DEFAULT 'single'");
  ensureColumn(db, "daily_log", "correct_cum", "correct_cum INTEGER DEFAULT 0");
  ensureColumn(db, "daily_log", "graded_cum", "graded_cum INTEGER DEFAULT 0");
  _db = db;
  return db;
}
