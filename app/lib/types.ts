export type AgentStatus = 'creating' | 'running' | 'stopped' | 'error';
export type ProviderType = 'anthropic' | 'openai' | 'google';

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
  containerStatus?: {
    running: boolean;
    cpu: string;
    memory: string;
    uptime: string;
  } | null;
  provider?: {
    id: string;
    provider: ProviderType;
    label: string;
  } | null;
}

export interface Provider {
  id: string;
  provider: ProviderType;
  label: string;
  keyPreview: string;
  authType: string;
  createdAt: string;
}
