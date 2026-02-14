import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { join } from 'path';
import { homedir } from 'os';

// Shared auth instance for Next.js API routes
// Connects to the same SQLite database as the orchestrator

let _auth: ReturnType<typeof betterAuth> | null = null;

export function getAuth() {
  if (_auth) return _auth;

  const dataDir = process.env.AGENTO_DATA_DIR || join(homedir(), '.agento');
  const dbPath = join(dataDir, 'agento.db');

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite);

  _auth = betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    emailAndPassword: { enabled: true },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: ['http://localhost:3000', 'https://localhost:3000'],
  });

  return _auth;
}
