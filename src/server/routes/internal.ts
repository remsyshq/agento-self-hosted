import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agents } from '../../db/schema.js';

export async function internalRoutes(fastify: FastifyInstance) {
  // POST /internal/credentials — credential callback from containers
  fastify.post<{
    Body: {
      event: string;
      profiles?: Record<string, unknown>;
      timestamp?: number;
    };
  }>('/credentials', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return reply.code(401).send({ error: 'Missing authorization token' });
    }

    // Find agent by gateway token
    const db = getDb();
    const allAgents = db.select().from(agents).all();

    const agent = allAgents.find((a) => {
      try {
        const config = typeof a.config === 'string' ? JSON.parse(a.config as string) : a.config;
        return (config as any)?.gatewayToken === token;
      } catch {
        return false;
      }
    });

    if (!agent) {
      return reply.code(403).send({ error: 'Invalid token' });
    }

    const { event, profiles } = request.body;

    fastify.log.info(
      { agentId: agent.id, event },
      'Credential callback received'
    );

    // For now, just acknowledge. In future, could update stored OAuth tokens.
    return { success: true, agentId: agent.id };
  });
}
