import { eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { settings, agents } from '../../db/schema.js';

const BASE_PORT = 18800;
const freedPorts = new Set<number>();

export function allocatePort(): number {
  // Reuse freed ports first
  if (freedPorts.size > 0) {
    const port = freedPorts.values().next().value!;
    freedPorts.delete(port);
    return port;
  }

  const db = getDb();
  const row = db.select().from(settings).where(eq(settings.key, 'port_counter')).get();
  const current = row ? parseInt(row.value, 10) : BASE_PORT;
  const next = current + 1;

  db.insert(settings)
    .values({ key: 'port_counter', value: String(next) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(next) } })
    .run();

  return current;
}

export function freePort(port: number) {
  freedPorts.add(port);
}

export function initFreedPorts() {
  // On startup, find ports from deleted/stopped agents that can be reused
  const db = getDb();
  const allAgents = db.select({ port: agents.port }).from(agents).all();
  const usedPorts = new Set(allAgents.map((a) => a.port).filter(Boolean));

  const row = db.select().from(settings).where(eq(settings.key, 'port_counter')).get();
  const maxPort = row ? parseInt(row.value, 10) : BASE_PORT;

  for (let p = BASE_PORT; p < maxPort; p++) {
    if (!usedPorts.has(p)) {
      freedPorts.add(p);
    }
  }
}
