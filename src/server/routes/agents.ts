import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '../../db/index.js';
import { agents, providers } from '../../db/schema.js';
import { removeContainer } from '../services/docker.js';
import { freePort } from '../services/ports.js';
import { getAgentStatus } from '../services/monitor.js';
import { getConfig } from '../../config.js';

export async function agentRoutes(fastify: FastifyInstance) {
  // GET /agents — list all agents
  fastify.get('/', async () => {
    const db = getDb();
    const allAgents = db.select().from(agents).all();
    return allAgents.map((a) => ({
      ...a,
      config: typeof a.config === 'string' ? JSON.parse(a.config) : a.config,
      containerStatus: getAgentStatus(a.id),
    }));
  });

  // POST /agents — create agent
  fastify.post<{
    Body: {
      name: string;
      providerId?: string;
      soulMd?: string;
      identityMd?: string;
    };
  }>('/', async (request, reply) => {
    const { name, providerId, soulMd, identityMd } = request.body;

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Name is required' });
    }

    const db = getDb();
    const config = getConfig();
    const id = randomUUID();
    const now = new Date().toISOString();

    const agent = {
      id,
      name: name.trim(),
      status: 'stopped' as const,
      containerId: null,
      port: null,
      image: config.dockerImage,
      config: JSON.stringify({}),
      soulMd: soulMd ?? null,
      identityMd: identityMd ?? null,
      providerId: providerId ?? null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      stoppedAt: null,
    };

    db.insert(agents).values(agent).run();

    return reply.code(201).send({ ...agent, config: {} });
  });

  // GET /agents/:id — get agent
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    // Get provider info
    let provider = null;
    if (agent.providerId) {
      provider = db.select().from(providers).where(eq(providers.id, agent.providerId)).get();
    }

    return {
      ...agent,
      config: typeof agent.config === 'string' ? JSON.parse(agent.config as string) : agent.config,
      containerStatus: getAgentStatus(agent.id),
      provider: provider ? { id: provider.id, provider: provider.provider, label: provider.label } : null,
    };
  });

  // PATCH /agents/:id — update agent
  fastify.patch<{
    Params: { id: string };
    Body: { name?: string; soulMd?: string; identityMd?: string; providerId?: string };
  }>('/:id', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (request.body.name !== undefined) updates.name = request.body.name;
    if (request.body.soulMd !== undefined) updates.soulMd = request.body.soulMd;
    if (request.body.identityMd !== undefined) updates.identityMd = request.body.identityMd;
    if (request.body.providerId !== undefined) updates.providerId = request.body.providerId;

    db.update(agents).set(updates).where(eq(agents.id, request.params.id)).run();

    return db.select().from(agents).where(eq(agents.id, request.params.id)).get();
  });

  // DELETE /agents/:id — delete agent + container
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    // Remove container if exists
    if (agent.containerId) {
      await removeContainer(agent.containerId);
    }

    // Free port
    if (agent.port) {
      freePort(agent.port);
    }

    db.delete(agents).where(eq(agents.id, request.params.id)).run();

    return { success: true };
  });
}
