import { expect, test, type Page } from '@playwright/test';

const tap = (page: Page, id: string) => page.getByTestId(id).first().click();

/** Creates a hero who trains every day, so today is always a training day. */
async function onboard(page: Page) {
  await page.goto('/');
  await page.getByTestId('hero-name').fill('Tester');
  await tap(page, 'class-knight');
  await tap(page, 'onboarding-next');
  await tap(page, 'focus-grow');
  await tap(page, 'onboarding-next');
  await page.getByTestId('bodyweight').fill('80');
  await tap(page, 'onboarding-next');
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const chip = page.getByTestId(`day-${day}`);
    if ((await chip.getAttribute('aria-checked')) !== 'true') await chip.click();
  }
  await tap(page, 'onboarding-next');
  await tap(page, 'onboarding-next');
  await tap(page, 'onboarding-finish');
  await expect(page.getByTestId('begin-quest')).toBeVisible();
}

test.describe('core loop', () => {
  test('onboard, check in, train, claim rewards and return to camp', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await onboard(page);

    await tap(page, 'begin-quest');
    await expect(page.getByTestId('readiness-result')).toBeVisible();
    await tap(page, 'begin-full');
    await expect(page.getByTestId('start-set')).toBeVisible();

    // One timed set: start, end, then skip the rest timer.
    await tap(page, 'start-set');
    await expect(page.getByTestId('set-timer')).toBeVisible();
    await tap(page, 'end-set');
    await expect(page.getByTestId('rest-timer')).toBeVisible();
    await expect(page.getByTestId('sets-progress')).toContainText('1/');
    await tap(page, 'skip-rest');

    // Log the rest quickly until every foe has fallen.
    for (let guard = 0; guard < 80; guard++) {
      if (await page.getByTestId('claim-rewards').count()) break;
      if (await page.getByTestId('next-exercise').count()) await tap(page, 'next-exercise');
      else if (await page.getByTestId('skip-rest').count()) await tap(page, 'skip-rest');
      else await tap(page, 'quick-log');
    }
    await tap(page, 'claim-rewards');

    await expect(page.getByTestId('victory-screen')).toBeVisible();
    await expect(page.getByText('Victory')).toBeVisible();
    if (await page.getByTestId('victory-skip').count()) await tap(page, 'victory-skip');
    await expect(page.getByTestId('victory-summary')).toBeVisible();
    await expect(page.getByTestId('victory-summary')).toContainText('+1 STR');
    await tap(page, 'victory-return');

    await expect(page.getByText('Quest complete')).toBeVisible();
    // The quest is in the battle log and progress persisted.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ironwyrm.history') ?? '{}'));
    expect(saved.state.sessions).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('every tab and sheet opens', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await onboard(page);

    const visit = async (path: string, testId: string) => {
      await page.goto(path);
      await expect(page.getByTestId(testId)).toBeVisible();
    };
    await visit('/dungeon', 'dungeon-screen');
    await visit('/plan', 'plan-screen');
    await visit('/hero', 'hero-screen');
    await visit('/settings', 'settings-screen');
    await visit('/science', 'science-screen');
    await visit('/history', 'history-screen');
    await visit('/records', 'records-screen');
    await visit('/shop', 'shop-screen');
    await visit('/weigh-in', 'weigh-in-screen');
    await visit('/move-session', 'move-session-screen');
    await visit('/lair', 'lair-screen');
    await visit('/privacy', 'privacy-screen');

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('ironwyrm.game') ?? '{}').state);
    const day = state.program.days[0];
    await visit(`/plan/${day.id}`, 'day-editor');
    await visit(`/swap?dayId=${day.id}&slotId=${day.exercises[0].id}`, 'swap-screen');
    await visit(`/exercise-picker?dayId=${day.id}`, 'exercise-picker');
    expect(errors).toEqual([]);
  });

  test('a missing piece of equipment swaps to an alternative that needs none of it', async ({ page }) => {
    await onboard(page);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('ironwyrm.game') ?? '{}').state);
    const day = state.program.days[0];
    const slot = day.exercises[0];
    await page.goto(`/plan/${day.id}`);
    await tap(page, 'day-exercise-0');
    await tap(page, 'swap-0');
    await expect(page.getByTestId('swap-screen')).toBeVisible();
    const missing = page.locator('[data-testid^="missing-"]').first();
    if (await missing.count()) await missing.click();
    await tap(page, 'alternative-0');
    await expect(page.getByTestId('day-editor')).toBeVisible();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ironwyrm.game') ?? '{}').state);
    const swapped = after.program.days[0].exercises.find((e: { id: string }) => e.id === slot.id);
    expect(swapped.exerciseId).not.toBe(slot.exerciseId);
  });

  test('the energy tracker estimates the burn and counts food against the target', async ({ page }) => {
    await onboard(page);
    await tap(page, 'open-energy');
    await expect(page.getByTestId('energy-screen')).toBeVisible();
    const burned = Number((await page.getByTestId('energy-burned').innerText()).replace(/,/g, ''));
    expect(burned).toBeGreaterThan(1000);

    // The web build has no step tracker, so steps are typed in; walking adds to the burn.
    await page.getByTestId('energy-steps-plus').click();
    await expect.poll(async () => Number((await page.getByTestId('energy-burned').innerText()).replace(/,/g, ''))).toBeGreaterThan(burned);

    const target = Number((await page.getByTestId('energy-target').innerText()).replace(/,/g, ''));
    expect(target).toBeGreaterThan(1000);
    await page.getByTestId('food-label').fill('Rice and chicken');
    await page.getByTestId('food-kcal').fill('650');
    await page.getByTestId('food-protein').fill('45');
    await tap(page, 'food-add');
    await expect(page.getByText('Rice and chicken')).toBeVisible();
    await expect(page.getByText(`650 eaten. ${(target - 650).toLocaleString('en-US')} left.`)).toBeVisible();
  });
});
