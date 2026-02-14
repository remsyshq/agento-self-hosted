export type AgentStatus = 'creating' | 'running' | 'stopped' | 'error';

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  containerId: string | null;
  port: number | null;
  image: string;
  config: Record<string, unknown>;
  soulMd: string | null;
  identityMd: string | null;
  providerId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
}

export type ProviderType = 'anthropic' | 'openai' | 'google';

export interface Provider {
  id: string;
  provider: ProviderType;
  label: string;
  keyPreview: string;
  encryptedKey: string;
  authType: 'api_key';
  createdAt: string;
}

export interface AppConfig {
  dataDir: string;
  port: number;
  frontendPort: number;
  dockerImage: string;
  tlsCert?: string;
  tlsKey?: string;
}

export interface ContainerStatus {
  running: boolean;
  cpu: string;
  memory: string;
  uptime: string;
}
