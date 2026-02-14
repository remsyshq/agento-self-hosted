import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agents } from '../../db/schema.js';

export async function agentChatRoutes(fastify: FastifyInstance) {
  // POST /agents/:id/chat — SSE proxy to container OpenClaw gateway
  fastify.post<{
    Params: { id: string };
    Body: { message: string; model?: string };
  }>('/:id/chat', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    if (agent.status !== 'running' || !agent.port) {
      return reply.code(400).send({ error: 'Agent is not running' });
    }

    const config = typeof agent.config === 'string' ? JSON.parse(agent.config as string) : agent.config;
    const gatewayToken = (config as any)?.gatewayToken;

    if (!gatewayToken) {
      return reply.code(500).send({ error: 'Agent gateway token not found' });
    }

    // Proxy to OpenClaw gateway's chat completions endpoint
    const url = `http://127.0.0.1:${agent.port}/v1/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({
          model: request.body.model || 'default',
          messages: [
            { role: 'user', content: request.body.message },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return reply.code(response.status).send({ error: 'Gateway error', details: text });
      }

      // Stream SSE response back to client
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const reader = response.body?.getReader();
      if (!reader) {
        reply.raw.end();
        return;
      }

      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reply.raw.end();
      }
    } catch (err: any) {
      return reply.code(502).send({ error: 'Failed to connect to agent', details: err.message });
    }
  });
}
