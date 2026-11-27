import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(2567),
  HOST: z.string().default('0.0.0.0'),
  /** HMAC secret for guest session tokens. REQUIRED in production (>= 32 chars). */
  SERVER_SECRET: z.string().min(32).optional(),
  /** Comma-separated list of allowed browser origins. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173'),
  DATA_DIR: z.string().default('./data'),
  /** "memory" (with JSON snapshot) for local dev, "supabase" for production persistence. */
  STORE: z.enum(['memory', 'supabase']).default('memory'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_JWT_SECRET: z.string().min(20).optional(),
  GUEST_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  READY_TIMEOUT_MS: z.coerce.number().int().min(3000).default(20_000),
  ROOM_TTL_MS: z.coerce.number().int().min(60_000).default(15 * 60_000),
  MAX_CONNECTIONS_PER_IP: z.coerce.number().int().min(1).default(12),
  GUEST_TOKENS_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  /** Path to a PRIVATE ranked pool (JSON array of content items). Never commit this file. */
  RANKED_POOL_FILE: z.string().optional(),
  /** Allow the PUBLIC development sample for ranked play. Defaults to true outside production only. */
  ALLOW_PUBLIC_RANKED_SAMPLE: z.enum(['true', 'false']).optional(),
});

export type Config = z.infer<typeof schema> & { secret: string; origins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production' && !c.SERVER_SECRET) {
    throw new Error('SERVER_SECRET (>= 32 characters) is required in production.');
  }
  if (c.STORE === 'supabase' && (!c.SUPABASE_URL || !c.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('STORE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  const secret = c.SERVER_SECRET ?? randomBytes(32).toString('hex');
  if (!c.SERVER_SECRET && c.NODE_ENV !== 'test') {
    console.warn('[config] SERVER_SECRET not set — using an ephemeral development secret. Guest tokens reset on restart.');
  }
  return { ...c, secret, origins: c.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) };
}
