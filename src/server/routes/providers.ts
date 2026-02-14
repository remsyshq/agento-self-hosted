import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '../../db/index.js';
import { providers } from '../../db/schema.js';
import { encrypt } from '../services/secrets.js';
import type { ProviderType } from '../../types.js';

function makeKeyPreview(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export async function providerRoutes(fastify: FastifyInstance) {
  // GET /providers — list all providers
  fastify.get('/', async () => {
    const db = getDb();
    const allProviders = db.select({
      id: providers.id,
      provider: providers.provider,
      label: providers.label,
      keyPreview: providers.keyPreview,
      authType: providers.authType,
      createdAt: providers.createdAt,
    }).from(providers).all();
    return allProviders;
  });

  // POST /providers — save a new API key
  fastify.post<{
    Body: {
      provider: ProviderType;
      label: string;
      apiKey: string;
    };
  }>('/', async (request, reply) => {
    const { provider, label, apiKey } = request.body;

    if (!provider || !apiKey) {
      return reply.code(400).send({ error: 'Provider and apiKey are required' });
    }

    const validProviders = ['anthropic', 'openai', 'google'];
    if (!validProviders.includes(provider)) {
      return reply.code(400).send({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
    }

    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    const record = {
      id,
      provider,
      label: label || provider,
      keyPreview: makeKeyPreview(apiKey),
      encryptedKey: encrypt(apiKey),
      authType: 'api_key',
      createdAt: now,
    };

    db.insert(providers).values(record).run();

    return reply.code(201).send({
      id: record.id,
      provider: record.provider,
      label: record.label,
      keyPreview: record.keyPreview,
      authType: record.authType,
      createdAt: record.createdAt,
    });
  });

  // DELETE /providers/:id — remove a provider
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const db = getDb();
    const provider = db.select().from(providers).where(eq(providers.id, request.params.id)).get();

    if (!provider) {
      return reply.code(404).send({ error: 'Provider not found' });
    }

    db.delete(providers).where(eq(providers.id, request.params.id)).run();
    return { success: true };
  });
}
