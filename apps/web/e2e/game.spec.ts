import { expect, test, type Page } from '@playwright/test';
/* End-to-end tests: real browser, real multiplayer server (see playwright.config.ts). */

async function skipOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /דילוג|Skip/ }).click();
}

test('guest lobby loads in Hebrew RTL and switches to English LTR', async ({ page }) => {
  await skipOnboarding(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.getByRole('button', { name: 'הגדרות' }).click();
  await page.getByRole('button', { name: 'English' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('Word Battle vs bot: answer, feedback and HP updates', async ({ page }) => {
  await skipOnboarding(page);
  await page.getByTestId('play').click();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  const firstAnswer = page.locator('.answer').first();
  await expect(firstAnswer).toBeEnabled({ timeout: 15_000 });
  // English answers render LTR even in the Hebrew UI.
  await expect(page.locator('.answer-grid').first()).toHaveCSS('direction', 'ltr');
  await firstAnswer.click();
  await expect(page.locator('.feedback')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/בוט|Bot/).first()).toBeVisible();
});

test('Sentence Master practice: keyboard building and feedback', async ({ page }) => {
  await skipOnboarding(page);
  await page.getByRole('button', { name: /^תרגול/ }).first().click();
  await page.getByRole('button', { name: /תרגול \(ללא זמן\)/ }).click();
  const pool = page.locator('.tiles__pool .tile-word');
  const n = await pool.count();
  expect(n).toBeGreaterThan(2);
  for (let i = 0; i < n; i++) await page.keyboard.press('1');
  await expect(page.locator('.tiles__answer .tile-word')).toHaveCount(n);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback')).toBeVisible();
});

test('two browsers play an online private match through the authoritative server', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await skipOnboarding(a);
  await skipOnboarding(b);

  // Open the Play screen and create a private room.
  await a.getByRole('button', { name: /מדורג|Ranked/ }).first().click();
  await a.getByTestId('private-room').click();
  await a.getByTestId('create-room').click();
  const code = (await a.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Player B joins via the shareable invitation link.
  await b.goto(`/?room=${code}`);

  for (const p of [a, b]) {
    await p.getByRole('button', { name: /אישור|Accept/ }).click({ timeout: 20_000 });
  }
  const promptA = a.locator('.q-prompt').first();
  const promptB = b.locator('.q-prompt').first();
  await expect(promptA).toBeVisible({ timeout: 30_000 });
  await expect(promptB).toBeVisible({ timeout: 30_000 });
  // Both players receive the same server question.
  await expect(promptA).toHaveText((await promptB.textContent())!);
  await a.locator('.answer').first().click();
  await b.locator('.answer').nth(1).click();
  await expect(a.locator('.feedback')).toBeVisible({ timeout: 20_000 });
  await expect(b.locator('.feedback')).toBeVisible({ timeout: 20_000 });
  // No bot is involved in an online match.
  await expect(a.locator('.chip--bot')).toHaveCount(0);
  await ctxA.close();
  await ctxB.close();
});

test('@mobile lobby has no horizontal overflow and the play button is reachable', async ({ page }) => {
  await skipOnboarding(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByTestId('play')).toBeInViewport();
});
