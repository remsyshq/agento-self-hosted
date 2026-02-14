import { eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agents } from '../../db/schema.js';
import { listManagedContainers, getContainerStatus, getContainerStats } from './docker.js';
import type { ContainerStatus } from '../../types.js';

const statusCache = new Map<string, ContainerStatus>();
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function getAgentStatus(agentId: string): ContainerStatus | null {
  return statusCache.get(agentId) ?? null;
}

export function getAllStatuses(): Map<string, ContainerStatus> {
  return statusCache;
}

async function poll() {
  try {
    const containers = await listManagedContainers();
    const db = getDb();

    // Track which agents we've seen
    const seen = new Set<string>();

    for (const container of containers) {
      seen.add(container.agentId);

      const status = await getContainerStatus(container.id);
      const stats = await getContainerStats(container.id);

      statusCache.set(container.agentId, {
        running: status.running,
        cpu: stats?.cpu ?? '0%',
        memory: stats?.memory ?? '0B / 0B',
        uptime: status.startedAt ?? '',
      });

      // Sync DB status if container crashed
      if (!status.running) {
        const agent = db.select().from(agents).where(eq(agents.id, container.agentId)).get();
        if (agent && agent.status === 'running') {
          db.update(agents)
            .set({
              status: 'error',
              lastError: `Container exited: ${status.status}`,
              stoppedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(agents.id, container.agentId))
            .run();
        }
      }
    }

    // Clear status for containers that no longer exist
    for (const [agentId] of statusCache) {
      if (!seen.has(agentId)) {
        statusCache.delete(agentId);
      }
    }
  } catch (err) {
    console.error('Monitor poll error:', err);
  }
}

export function startMonitor(intervalMs = 10_000) {
  if (pollInterval) return;
  poll(); // initial poll
  pollInterval = setInterval(poll, intervalMs);
}

export function stopMonitor() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
