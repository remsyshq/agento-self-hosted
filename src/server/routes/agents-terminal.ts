import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { spawn } from 'child_process';
import { getDb } from '../../db/index.js';
import { agents } from '../../db/schema.js';

export async function agentTerminalRoutes(fastify: FastifyInstance) {
  // GET /agents/:id/terminal — WebSocket terminal proxy
  fastify.get<{ Params: { id: string } }>(
    '/:id/terminal',
    { websocket: true },
    async (socket, request) => {
      const db = getDb();
      const agent = db
        .select()
        .from(agents)
        .where(eq(agents.id, request.params.id))
        .get();

      if (!agent || !agent.containerId) {
        socket.close(1008, 'Agent not found or no container');
        return;
      }

      // Exec into container with interactive shell
      const proc = spawn('docker', [
        'exec',
        '-it',
        agent.containerId,
        '/bin/bash',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stdout.on('data', (data: Buffer) => {
        socket.send(data);
      });

      proc.stderr.on('data', (data: Buffer) => {
        socket.send(data);
      });

      proc.on('close', (code) => {
        socket.close(1000, `Shell exited with code ${code}`);
      });

      socket.on('message', (data: Buffer | string) => {
        proc.stdin.write(typeof data === 'string' ? data : data.toString());
      });

      socket.on('close', () => {
        proc.kill();
      });
    }
  );
}
