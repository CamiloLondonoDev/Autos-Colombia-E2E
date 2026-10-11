import { defineConfig, devices } from '@playwright/test';

// BASE_URL arrives from client_payload.deployed_url (see .github/workflows/e2e.yml).
// GitHub Pages serves the app under a sub-path, so the URL must end with "/"
// for relative navigations like page.goto('HTML/login.html') to resolve under it.
const raw = process.env.BASE_URL ?? (process.env.CI ? '' : 'http://localhost:8080/');
if (!raw) {
  throw new Error('BASE_URL is required in CI (client_payload.deployed_url).');
}
const baseURL = raw.endsWith('/') ? raw : `${raw}/`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Colombia has no DST; fixing the zone makes date maths deterministic
    // regardless of the machine running the tests.
    timezoneId: 'America/Bogota',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
