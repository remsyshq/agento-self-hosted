import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agents, providers } from '../../db/schema.js';
import { startContainer, stopContainer, removeContainer, getContainerStatus } from '../services/docker.js';
import { allocatePort } from '../services/ports.js';
import { generateGatewayToken } from '../services/secrets.js';
import { getAgentStatus } from '../services/monitor.js';
import type { ProviderType } from '../../types.js';

export async function agentLifecycleRoutes(fastify: FastifyInstance) {
  // POST /agents/:id/start
  fastify.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    if (agent.status === 'running' && agent.containerId) {
      const cs = await getContainerStatus(agent.containerId);
      if (cs.running) {
        return reply.code(409).send({ error: 'Agent is already running' });
      }
    }

    // Get provider for API key
    let provider = null;
    if (agent.providerId) {
      provider = db.select().from(providers).where(eq(providers.id, agent.providerId)).get();
    }

    if (!provider) {
      return reply.code(400).send({ error: 'Agent has no provider configured. Add an API key first.' });
    }

    // Remove old container if exists
    if (agent.containerId) {
      await removeContainer(agent.containerId);
    }

    const port = agent.port ?? allocatePort();
    const gatewayToken = generateGatewayToken();
    const now = new Date().toISOString();

    // Update status to creating
    db.update(agents)
      .set({ status: 'creating', port, updatedAt: now, lastError: null })
      .where(eq(agents.id, agent.id))
      .run();

    try {
      const containerId = await startContainer({
        agentId: agent.id,
        name: agent.name,
        port,
        image: agent.image,
        providerId: agent.providerId,
        providerType: provider.provider as ProviderType,
        encryptedKey: provider.encryptedKey,
        soulMd: agent.soulMd,
        identityMd: agent.identityMd,
        gatewayToken,
        config: typeof agent.config === 'string' ? JSON.parse(agent.config as string) : agent.config as Record<string, unknown>,
      });

      // Store gateway token in agent config for credential callbacks
      const agentConfig = typeof agent.config === 'string' ? JSON.parse(agent.config as string) : agent.config;
      const updatedConfig = { ...agentConfig as Record<string, unknown>, gatewayToken };

      db.update(agents)
        .set({
          status: 'running',
          containerId,
          port,
          startedAt: now,
          stoppedAt: null,
          config: JSON.stringify(updatedConfig),
          updatedAt: now,
        })
        .where(eq(agents.id, agent.id))
        .run();

      return { success: true, containerId, port };
    } catch (err: any) {
      db.update(agents)
        .set({
          status: 'error',
          lastError: err.message,
          updatedAt: now,
        })
        .where(eq(agents.id, agent.id))
        .run();

      return reply.code(500).send({ error: 'Failed to start container', details: err.message });
    }
  });

  // POST /agents/:id/stop
  fastify.post<{ Params: { id: string } }>('/:id/stop', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    if (agent.containerId) {
      try {
        await stopContainer(agent.containerId);
      } catch { /* container may already be stopped */ }
    }

    const now = new Date().toISOString();
    db.update(agents)
      .set({ status: 'stopped', stoppedAt: now, updatedAt: now })
      .where(eq(agents.id, agent.id))
      .run();

    return { success: true };
  });

  // POST /agents/:id/restart
  fastify.post<{ Params: { id: string } }>('/:id/restart', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    // Stop first
    if (agent.containerId) {
      await removeContainer(agent.containerId);
    }

    // Get provider
    let provider = null;
    if (agent.providerId) {
      provider = db.select().from(providers).where(eq(providers.id, agent.providerId)).get();
    }

    if (!provider) {
      return reply.code(400).send({ error: 'Agent has no provider configured.' });
    }

    const port = agent.port ?? allocatePort();
    const gatewayToken = generateGatewayToken();
    const now = new Date().toISOString();

    try {
      const containerId = await startContainer({
        agentId: agent.id,
        name: agent.name,
        port,
        image: agent.image,
        providerId: agent.providerId,
        providerType: provider.provider as ProviderType,
        encryptedKey: provider.encryptedKey,
        soulMd: agent.soulMd,
        identityMd: agent.identityMd,
        gatewayToken,
        config: typeof agent.config === 'string' ? JSON.parse(agent.config as string) : agent.config as Record<string, unknown>,
      });

      const agentConfig = typeof agent.config === 'string' ? JSON.parse(agent.config as string) : agent.config;
      const updatedConfig = { ...agentConfig as Record<string, unknown>, gatewayToken };

      db.update(agents)
        .set({
          status: 'running',
          containerId,
          port,
          startedAt: now,
          stoppedAt: null,
          lastError: null,
          config: JSON.stringify(updatedConfig),
          updatedAt: now,
        })
        .where(eq(agents.id, agent.id))
        .run();

      return { success: true, containerId, port };
    } catch (err: any) {
      db.update(agents)
        .set({ status: 'error', lastError: err.message, updatedAt: now })
        .where(eq(agents.id, agent.id))
        .run();

      return reply.code(500).send({ error: 'Failed to restart container', details: err.message });
    }
  });

  // GET /agents/:id/status
  fastify.get<{ Params: { id: string } }>('/:id/status', async (request, reply) => {
    const status = getAgentStatus(request.params.id);
    if (!status) {
      return reply.code(404).send({ error: 'No status available' });
    }
    return status;
  });
}
