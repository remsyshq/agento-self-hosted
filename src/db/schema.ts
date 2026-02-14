import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ── Agents ──────────────────────────────────────────────────────────────────

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status', { enum: ['creating', 'running', 'stopped', 'error'] }).notNull().default('stopped'),
  containerId: text('container_id'),
  port: integer('port'),
  image: text('image').notNull(),
  config: text('config', { mode: 'json' }).notNull().default('{}'),
  soulMd: text('soul_md'),
  identityMd: text('identity_md'),
  providerId: text('provider_id').references(() => providers.id),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  startedAt: text('started_at'),
  stoppedAt: text('stopped_at'),
});

// ── Providers (LLM API keys) ───────────────────────────────────────────────

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['anthropic', 'openai', 'google'] }).notNull(),
  label: text('label').notNull(),
  keyPreview: text('key_preview').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  authType: text('auth_type').notNull().default('api_key'),
  createdAt: text('created_at').notNull(),
});

// ── Settings (key-value store) ──────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ── better-auth tables ──────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: text('expires_at'),
  password: text('password'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
