import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, writeFileSync, chownSync } from 'fs';
import { join } from 'path';
import { getConfig, getDataDir } from '../../config.js';
import { decrypt } from './secrets.js';
import type { ProviderType } from '../../types.js';

const execAsync = promisify(exec);

interface AgentStartOptions {
  agentId: string;
  name: string;
  port: number;
  image: string;
  providerId?: string | null;
  providerType?: ProviderType;
  encryptedKey?: string;
  soulMd?: string | null;
  identityMd?: string | null;
  gatewayToken: string;
  config?: Record<string, unknown>;
}

const MODEL_MAP: Record<ProviderType, string> = {
  anthropic: 'anthropic/claude-sonnet-4-5-20250929',
  openai: 'openai/gpt-4.1',
  google: 'google/gemini-2.5-pro',
};

const ENV_KEY_MAP: Record<ProviderType, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
};

export function buildOpenClawConfig(opts: AgentStartOptions): Record<string, unknown> {
  const model = opts.providerType ? MODEL_MAP[opts.providerType] : 'anthropic/claude-sonnet-4-5-20250929';

  return {
    gateway: {
      mode: 'local',
      bind: 'lan',
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
        },
      },
    },
    discovery: {
      mdns: { mode: 'off' },
    },
    agents: {
      defaults: {
        workspace: '~/.openclaw/workspace',
        model: { primary: model },
      },
      list: [
        {
          id: opts.agentId,
          name: opts.name,
          default: true,
          workspace: '~/.openclaw/workspace',
          model,
          identity: { name: opts.name },
        },
      ],
    },
    plugins: {
      entries: {
        'camofox-browser': { enabled: true },
      },
    },
  };
}

export async function prepareAgentDir(opts: AgentStartOptions): Promise<string> {
  const dataDir = getDataDir();
  const agentDir = join(dataDir, 'agents', opts.agentId);
  const configDir = join(agentDir, 'config');
  const workspaceDir = join(agentDir, 'workspace');

  mkdirSync(configDir, { recursive: true });
  mkdirSync(workspaceDir, { recursive: true });

  // Write openclaw.json
  const openclawConfig = buildOpenClawConfig(opts);
  writeFileSync(
    join(configDir, 'openclaw.json'),
    JSON.stringify(openclawConfig, null, 2) + '\n'
  );

  // Write SOUL.md if provided
  if (opts.soulMd) {
    const agentConfigDir = join(configDir, 'agents', 'main', 'agent');
    mkdirSync(agentConfigDir, { recursive: true });
    writeFileSync(join(agentConfigDir, 'SOUL.md'), opts.soulMd);
  }

  // Write IDENTITY.md if provided
  if (opts.identityMd) {
    const agentConfigDir = join(configDir, 'agents', 'main', 'agent');
    mkdirSync(agentConfigDir, { recursive: true });
    writeFileSync(join(agentConfigDir, 'IDENTITY.md'), opts.identityMd);
  }

  return agentDir;
}

export function buildRunCommand(opts: AgentStartOptions, agentDir: string): string {
  const config = getConfig();
  const configDir = join(agentDir, 'config');
  const workspaceDir = join(agentDir, 'workspace');

  const args: string[] = [
    'docker', 'run', '-d',
    '--name', `agento-${opts.agentId.slice(0, 8)}`,
    '--restart', 'unless-stopped',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pids-limit=512',
    '--memory=8g',
    '--cpus=2',
    '-p', `127.0.0.1:${opts.port}:8080`,
    '-v', `${configDir}:/home/node/.openclaw:rw`,
    '-v', `${workspaceDir}:/home/node/.openclaw/workspace:rw`,
    '--tmpfs', '/tmp:rw,nosuid,size=256m',
    '-e', `AGENT_ID=${opts.agentId}`,
    '-e', 'OPENCLAW_GATEWAY_BIND=lan',
    '-e', `OPENCLAW_GATEWAY_TOKEN=${opts.gatewayToken}`,
    '-e', 'OPENCLAW_HEADLESS=1',
    '-e', `OPENCLAW_CREDENTIALS_CALLBACK_URL=http://host.docker.internal:${config.port}/internal/credentials`,
    '-e', `OPENCLAW_CREDENTIALS_CALLBACK_TOKEN=${opts.gatewayToken}`,
    '--label', `agento.agent.id=${opts.agentId}`,
    '--label', 'agento.managed=true',
  ];

  // Add API key env var
  if (opts.encryptedKey && opts.providerType) {
    const apiKey = decrypt(opts.encryptedKey);
    const envVar = ENV_KEY_MAP[opts.providerType];
    args.push('-e', `${envVar}=${apiKey}`);
  }

  args.push(opts.image, 'node', 'dist/index.js', 'gateway', '--bind', 'lan');

  return args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
}

export async function startContainer(opts: AgentStartOptions): Promise<string> {
  const agentDir = await prepareAgentDir(opts);
  const cmd = buildRunCommand(opts, agentDir);
  const { stdout } = await execAsync(cmd);
  return stdout.trim(); // container ID
}

export async function stopContainer(containerId: string): Promise<void> {
  await execAsync(`docker stop ${containerId}`);
}

export async function removeContainer(containerId: string): Promise<void> {
  try {
    await execAsync(`docker stop ${containerId}`);
  } catch { /* may already be stopped */ }
  try {
    await execAsync(`docker rm ${containerId}`);
  } catch { /* may already be removed */ }
}

export async function getContainerStatus(containerId: string): Promise<{
  running: boolean;
  status: string;
  startedAt: string | null;
}> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format '{{.State.Running}}|{{.State.Status}}|{{.State.StartedAt}}' ${containerId}`
    );
    const [running, status, startedAt] = stdout.trim().split('|');
    return {
      running: running === 'true',
      status,
      startedAt: startedAt || null,
    };
  } catch {
    return { running: false, status: 'not_found', startedAt: null };
  }
}

export async function getContainerStats(containerId: string): Promise<{
  cpu: string;
  memory: string;
} | null> {
  try {
    const { stdout } = await execAsync(
      `docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}' ${containerId}`
    );
    const [cpu, memory] = stdout.trim().split('|');
    return { cpu: cpu.trim(), memory: memory.trim() };
  } catch {
    return null;
  }
}

export async function getContainerLogs(
  containerId: string,
  opts: { tail?: number; since?: string } = {}
): Promise<string> {
  const args = ['docker', 'logs'];
  if (opts.tail) args.push('--tail', String(opts.tail));
  if (opts.since) args.push('--since', opts.since);
  args.push(containerId);

  const { stdout, stderr } = await execAsync(args.join(' '));
  return stdout + stderr;
}

export async function listManagedContainers(): Promise<
  Array<{ id: string; name: string; status: string; agentId: string }>
> {
  try {
    const { stdout } = await execAsync(
      `docker ps -a --filter label=agento.managed=true --format '{{.ID}}|{{.Names}}|{{.Status}}|{{.Label "agento.agent.id"}}'`
    );
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, name, status, agentId] = line.split('|');
        return { id, name, status, agentId };
      });
  } catch {
    return [];
  }
}
