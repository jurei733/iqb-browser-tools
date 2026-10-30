import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: {timeout: 15_000},
  reporter: [
    ['list'],
    ['html', {open: 'never'}],
    ['json', {outputFile: 'test-results/results.json'}]
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: {width: 1440, height: 1000},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: ['chromium', 'firefox', 'webkit'].map(name=>({name, use: {browserName: name}})),
  webServer: [
    {
      command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false
    },
    {
      command: 'pnpm exec vite preview --outDir work/browser-tests --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174/tests/browser.html',
      reuseExistingServer: false
    }
  ]
});
