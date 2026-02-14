import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { spawn } from 'child_process';
import { getDb } from '../../db/index.js';
import { agents } from '../../db/schema.js';

export async function agentLogsRoutes(fastify: FastifyInstance) {
  // GET /agents/:id/logs — SSE Docker logs stream
  fastify.get<{
    Params: { id: string };
    Querystring: { tail?: string };
  }>('/:id/logs', async (request, reply) => {
    const db = getDb();
    const agent = db.select().from(agents).where(eq(agents.id, request.params.id)).get();

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    if (!agent.containerId) {
      return reply.code(400).send({ error: 'Agent has no container' });
    }

    const tail = request.query.tail || '100';

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const proc = spawn('docker', ['logs', '--follow', '--tail', tail, agent.containerId]);

    const sendLine = (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          reply.raw.write(`data: ${JSON.stringify({ line })}\n\n`);
        }
      }
    };

    proc.stdout.on('data', sendLine);
    proc.stderr.on('data', sendLine);

    proc.on('close', () => {
      reply.raw.write('event: close\ndata: {}\n\n');
      reply.raw.end();
    });

    request.raw.on('close', () => {
      proc.kill();
    });
  });
}
