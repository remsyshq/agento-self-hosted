import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { getConfig } from '../config.js';
import { join } from 'path';

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: DatabaseType | null = null;

export function getDb() {
  if (_db) return _db;

  const config = getConfig();
  const dbPath = join(config.dataDir, 'agento.db');
  _sqlite = new Database(dbPath);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');
  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function getSqlite(): DatabaseType {
  if (!_sqlite) getDb();
  return _sqlite!;
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}
