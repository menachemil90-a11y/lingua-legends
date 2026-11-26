import { loadConfig } from './config';
import { startServer } from './app';
import { MemoryStore } from './store/memoryStore';
import { SupabaseStore } from './store/supabaseStore';

async function main() {
  const cfg = loadConfig();
  const store = cfg.STORE === 'supabase' ? new SupabaseStore(cfg.SUPABASE_URL!, cfg.SUPABASE_SERVICE_ROLE_KEY!) : new MemoryStore(cfg.DATA_DIR);
  const server = await startServer(cfg, store);
  console.info(`[lingua-legends] multiplayer server listening on ${cfg.HOST}:${server.port} (store=${cfg.STORE})`);
  const shutdown = async (signal: string) => {
    console.info(`[lingua-legends] ${signal} received, shutting down`);
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
