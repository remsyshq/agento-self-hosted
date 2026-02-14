import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getConfig, getDataDir } from '../config.js';
import { runMigrations } from '../db/migrate.js';
import { initFreedPorts } from './services/ports.js';
import { startMonitor, stopMonitor } from './services/monitor.js';
import { authMiddleware } from './auth-middleware.js';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { agentLifecycleRoutes } from './routes/agents-lifecycle.js';
import { agentChatRoutes } from './routes/agents-chat.js';
import { agentLogsRoutes } from './routes/agents-logs.js';
import { agentTerminalRoutes } from './routes/agents-terminal.js';
import { internalRoutes } from './routes/internal.js';
import { providerRoutes } from './routes/providers.js';

export async function startServer() {
  const config = getConfig();

  // Run migrations
  runMigrations();
  initFreedPorts();

  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
  });

  // Plugins
  await fastify.register(cors, {
    origin: [
      `http://localhost:${config.frontendPort}`,
      `https://localhost:${config.frontendPort}`,
    ],
    credentials: true,
  });
  await fastify.register(websocket);

  // Auth middleware
  fastify.addHook('onRequest', authMiddleware);

  // Routes
  await fastify.register(healthRoutes);
  await fastify.register(agentRoutes, { prefix: '/agents' });
  await fastify.register(agentLifecycleRoutes, { prefix: '/agents' });
  await fastify.register(agentChatRoutes, { prefix: '/agents' });
  await fastify.register(agentLogsRoutes, { prefix: '/agents' });
  await fastify.register(agentTerminalRoutes, { prefix: '/agents' });
  await fastify.register(internalRoutes, { prefix: '/internal' });
  await fastify.register(providerRoutes, { prefix: '/providers' });

  // Start monitor
  startMonitor();

  // Write PID file
  writeFileSync(join(getDataDir(), 'agento.pid'), String(process.pid));

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n  Shutting down...');
    stopMonitor();
    await fastify.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start listening
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`\n  Orchestrator running on http://localhost:${config.port}`);
  console.log(`  Frontend:     http://localhost:${config.frontendPort}\n`);
}
