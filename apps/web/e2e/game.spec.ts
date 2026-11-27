import { expect, test, type Page } from '@playwright/test';
import { DETECTIVE_CASES, ESCAPE_ROOMS } from '@lingua/content';
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

async function pickMode(page: Page, name: string) {
  await page.locator('.mode-card').click();
  await page.locator('.mode-row', { hasText: name }).click();
  await page.getByTestId('play').click();
}

test('Escape Room: open a puzzle, solve it and see the lock open', async ({ page }) => {
  await skipOnboarding(page);
  await pickMode(page, 'Escape Room');
  const room = ESCAPE_ROOMS[0]!;
  await page.locator('.escape-card').first().click();
  await page.getByTestId('enter-room').click();
  const puzzle = room.puzzles.find((p) => p.kind === 'choice');
  if (!puzzle || puzzle.kind !== 'choice') throw new Error('expected a choice puzzle in the first room');
  await page.getByRole('button', { name: puzzle.title }).click();
  await page.locator('.answer', { hasText: puzzle.options[puzzle.answer]! }).click();
  await expect(page.locator('.answer--correct')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.lock--open')).toHaveCount(1);
});

test('English Conquest: start against bots and see the 12-island map', async ({ page }) => {
  await skipOnboarding(page);
  await pickMode(page, 'English Conquest');
  await page.getByTestId('start-conquest').click();
  await expect(page.locator('.cq-terr')).toHaveCount(12);
  await expect(page.getByText(/בוט|Bot/).first()).toBeVisible();
});

test('Listening lab starts a session with a play control', async ({ page }) => {
  await skipOnboarding(page);
  await page.getByRole('button', { name: /^תרגול/ }).first().click();
  await page.getByTestId('start-listening').click();
  await expect(page.locator('.quiz')).toBeVisible();
  await expect(page.locator('.answer').first()).toBeVisible();
});

test('Real Life: open a scenario from the list and get feedback on a reply (regression: stale route state)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await skipOnboarding(page);
  await pickMode(page, 'Real Life');
  await page.locator('.tile', { hasText: 'ישיבת הבוקר' }).click();
  await expect(page.locator('.bubble-npc').first()).toContainText('Morning, everyone');
  await page.locator('.answer').first().click();
  await expect(page.locator('.convo .chip--good').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('English Detective: solve the A2 case by reading the evidence (options are shuffled)', async ({ page }) => {
  await skipOnboarding(page);
  await pickMode(page, 'English Detective');
  const c = DETECTIVE_CASES.find((x) => x.id === 'case-wrong-cake')!;
  await page.locator('.tile', { hasText: c.titleHe }).click();
  for (const q of c.questions) {
    await page.locator('.answer', { hasText: q.options[q.answer]! }).click();
    await expect(page.locator('.answer--correct')).toHaveCount(1);
    await page.getByRole('button', { name: /הבא|Next/ }).click();
  }
  const culprit = c.suspects.find((s) => s.id === c.culpritId)!;
  await page.getByRole('button', { name: new RegExp(culprit.name) }).click();
  await expect(page.locator('.feedback--good')).toBeVisible();
});

test("Champion's Cup: start a cup and play the quarter-final against a labelled bot", async ({ page }) => {
  await skipOnboarding(page);
  await page.locator('.lobby-tile').first().click();
  await page.getByTestId('open-tournaments').click();
  await page.getByTestId('cup-start').click();
  await expect(page.getByTestId('cup-round-0')).toHaveClass(/cup-node--next/);
  await expect(page.getByTestId('cup-round-2')).toHaveClass(/cup-node--locked/);
  await page.getByTestId('cup-play').click();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/בוט|Bot/).first()).toBeVisible();
});

test('three browsers start a friends tournament; exactly two are called to the first match', async ({ browser }) => {
  const ctxs = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [a, b, c] = await Promise.all(ctxs.map((x) => x.newPage()));
  for (const p of [a!, b!, c!]) await skipOnboarding(p);
  await a!.locator('.lobby-tile').first().click();
  await a!.getByTestId('open-tournaments').click();
  await a!.getByRole('button', { name: /^(עם חברים|With friends)$/ }).click();
  await a!.getByTestId('tournament-create').click({ timeout: 15_000 });
  const code = (await a!.getByTestId('tournament-code').textContent())!.trim();
  for (const p of [b!, c!]) await p.goto(`/?tournament=${code}`);
  await expect(a!.getByTestId('tournament-start')).toBeEnabled({ timeout: 15_000 });
  await a!.getByTestId('tournament-start').click();
  for (const p of [a!, b!, c!]) await expect(p.getByTestId('bracket')).toBeVisible({ timeout: 15_000 });
  // The server launches the semi-final for the two players without a bye.
  const accept = (p: Page) => p.getByRole('button', { name: /אישור|Accept/ });
  await expect.poll(async () => (await accept(a!).count()) + (await accept(b!).count()) + (await accept(c!).count()), { timeout: 20_000 }).toBe(2);
  await expect(a!.locator('.chip--bot')).toHaveCount(0);
  for (const x of ctxs) await x.close();
});

test('Debate Arena: opening, rebuttal and closing lead to a transparent checklist', async ({ page }) => {
  await skipOnboarding(page);
  await pickMode(page, 'Debate Arena');
  await page.getByTestId('debate-topic-debate-weekend-homework').click();
  const opening =
    'In my opinion, teachers should not give homework at the weekend because students need real rest. For example, many students have sports games or family visits on Saturday. Moreover, tired students learn less on Sunday morning, so a free weekend actually helps learning. Therefore weekends should belong to rest and hobbies.';
  await page.getByTestId('debate-opening').fill(opening);
  await page.getByTestId('debate-next').click();
  await page
    .getByTestId('debate-rebuttal')
    .fill('Some people argue that weekend homework helps students remember the lessons. However, short reviews during the week work just as well, and they do not take away family time. As a result, the benefit of weekend homework is small.');
  await page.getByTestId('debate-next').click();
  await page.getByTestId('debate-closing').fill('To sum up, free weekends make students healthier and more focused, so the benefits of rest are clearly greater than the costs.');
  await page.getByTestId('debate-finish').click();
  await expect(page.getByTestId('debate-checklist').locator('li')).toHaveCount(8);
  await expect(page.getByTestId('debate-checklist').locator('.finding--good').first()).toBeVisible();
});

test('two browsers play English Conquest online: question for the active player, turn passes', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await skipOnboarding(a);
  await skipOnboarding(b);
  await pickMode(a, 'English Conquest');
  await a.getByTestId('conquest-online').click();
  await a.getByTestId('create-room').click();
  const code = (await a.getByTestId('room-code').textContent())!.trim();
  await b.goto(`/?room=${code}`);
  await a.getByTestId('start-room').click({ timeout: 20_000 });
  for (const p of [a, b]) await p.getByRole('button', { name: /אישור|Accept/ }).click({ timeout: 20_000 });
  for (const p of [a, b]) await expect(p.locator('.conquest-map')).toBeVisible({ timeout: 20_000 });

  // Exactly one player gets the question dialog.
  const qcard = (p: Page) => p.locator('.qcard');
  await expect.poll(async () => (await qcard(a).count()) + (await qcard(b).count()), { timeout: 20_000 }).toBe(1);
  const [active, other] = (await qcard(a).count()) > 0 ? [a, b] : [b, a];
  await expect(qcard(other)).toHaveCount(0);
  await active.locator('.answer').first().click();
  await active.getByTestId('cq-continue').click({ timeout: 15_000 });
  await active.getByTestId('cq-end-turn').click();
  // The turn passes to the other browser, which now receives its own question.
  await expect(qcard(other)).toBeVisible({ timeout: 20_000 });
  await expect(a.locator('.chip--bot')).toHaveCount(0);
  await ctxA.close();
  await ctxB.close();
});

test('two browsers solve a co-op Escape Room lock together through the server', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await skipOnboarding(a);
  await skipOnboarding(b);
  await pickMode(a, 'Escape Room');
  await a.getByTestId('escape-coop-escape-clockmaker').click();
  await a.getByTestId('create-room').click();
  const code = (await a.getByTestId('room-code').textContent())!.trim();
  await b.goto(`/?room=${code}`);
  await a.getByTestId('start-room').click({ timeout: 20_000 });
  for (const p of [a, b]) await p.getByRole('button', { name: /אישור|Accept/ }).click({ timeout: 20_000 });
  for (const p of [a, b]) await expect(p.locator('.room-scene')).toBeVisible({ timeout: 20_000 });
  const room = ESCAPE_ROOMS.find((r) => r.id === 'escape-clockmaker')!;
  const puzzle = room.puzzles.find((p) => p.kind === 'choice');
  if (!puzzle || puzzle.kind !== 'choice') throw new Error('expected a choice puzzle');
  await a.waitForTimeout(3500); // countdown
  await a.getByRole('button', { name: puzzle.title }).click();
  await a.locator('.answer', { hasText: puzzle.options[puzzle.answer]! }).click();
  // Player B sees the lock open and who opened it.
  await expect(b.locator('.lock--open')).toHaveCount(1, { timeout: 15_000 });
  await expect(b.getByTestId('escape-feed')).toBeVisible();
  await expect(b.locator('.chip--bot')).toHaveCount(0);
  await ctxA.close();
  await ctxB.close();
});

/**
 * Elements that stick out of the viewport. `body` hides horizontal overflow, so content wider than the
 * screen is silently cut off rather than scrollable; we look for elements no ancestor clips or scrolls.
 */
const layoutOverflow = (page: Page) =>
  page.evaluate(() => {
    const W = window.innerWidth;
    const out = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && (r.right > W + 1 || r.left < -1))) return false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return false;
      return true;
    });
    return out.length;
  });

test('@mobile lobby and play screens fit the device width; the play button is reachable', async ({ page }) => {
  await skipOnboarding(page);
  expect(await layoutOverflow(page)).toBeLessThanOrEqual(0);
  await expect(page.getByTestId('play')).toBeInViewport();
  await page.locator('.lobby-tile').first().click();
  await expect(page.locator('.mode-picker')).toBeVisible();
  expect(await layoutOverflow(page)).toBeLessThanOrEqual(0);
});
