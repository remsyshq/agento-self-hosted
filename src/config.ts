import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { AppConfig } from './types.js';

const DEFAULT_DATA_DIR = join(homedir(), '.agento');
const CONFIG_FILE = 'config.json';

const DEFAULT_CONFIG: AppConfig = {
  dataDir: DEFAULT_DATA_DIR,
  port: 3001,
  frontendPort: 3000,
  dockerImage: 'openclaw:latest',
};

let _config: AppConfig | null = null;

export function getDataDir(): string {
  return process.env.AGENTO_DATA_DIR || DEFAULT_DATA_DIR;
}

export function getConfig(): AppConfig {
  if (_config) return _config;

  const dataDir = getDataDir();
  const configPath = join(dataDir, CONFIG_FILE);

  if (!existsSync(configPath)) {
    _config = { ...DEFAULT_CONFIG, dataDir };
    return _config;
  }

  const raw = readFileSync(configPath, 'utf-8');
  _config = { ...DEFAULT_CONFIG, ...JSON.parse(raw), dataDir };
  return _config;
}

export function saveConfig(config: Partial<AppConfig>) {
  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });

  const current = getConfig();
  const merged = { ...current, ...config };
  const configPath = join(dataDir, CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n');
  _config = merged;
  return merged;
}

export function ensureDataDir() {
  const dataDir = getDataDir();
  const dirs = [
    dataDir,
    join(dataDir, 'agents'),
    join(dataDir, 'tls'),
  ];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
  return dataDir;
}
