import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from '../auth.js';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for health and internal endpoints
  const url = request.url;
  if (url === '/health' || url.startsWith('/internal/')) {
    return;
  }

  const auth = getAuth();

  // Check for session cookie or bearer token
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieHeader = request.headers.cookie;

  if (!token && !cookieHeader) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  try {
    // Use better-auth to validate the session
    const session = await auth.api.getSession({
      headers: new Headers(
        Object.entries(request.headers).reduce(
          (acc, [k, v]) => {
            if (v) acc[k] = Array.isArray(v) ? v.join(', ') : v;
            return acc;
          },
          {} as Record<string, string>
        )
      ),
    });

    if (!session) {
      reply.code(401).send({ error: 'Invalid session' });
      return;
    }

    // Attach user to request
    (request as any).userId = session.user.id;
    (request as any).user = session.user;
  } catch {
    reply.code(401).send({ error: 'Invalid session' });
  }
}
