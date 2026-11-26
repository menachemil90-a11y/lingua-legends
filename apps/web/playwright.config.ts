import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 4174;
const SERVER_PORT = 2568;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'pnpm --filter @lingua/server exec tsx src/index.ts',
      url: `http://localhost:${SERVER_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(SERVER_PORT),
        NODE_ENV: 'test',
        SERVER_SECRET: 'e2e-test-secret-'.padEnd(48, 'z'),
        ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
        READY_TIMEOUT_MS: '20000',
        DATA_DIR: '',
      },
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_MULTIPLAYER_URL: `http://localhost:${SERVER_PORT}` },
    },
  ],
});
