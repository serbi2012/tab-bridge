import { test, expect } from '@playwright/test';

const PAGE_URL = '/e2e/fixtures/test-page.html';

test.describe('State Sync E2E', () => {
  test('syncs state from Tab A to Tab B', async ({ context }) => {
    const page_a = await context.newPage();
    const page_b = await context.newPage();

    await page_a.goto(PAGE_URL);
    await page_b.goto(PAGE_URL);

    await expect(page_a.locator('#status')).toHaveText('ready');
    await expect(page_b.locator('#status')).toHaveText('ready');

    await page_a.evaluate(() => {
      (window as any).__tabSync.set('count', 42);
    });

    await expect(page_b.locator('#state-display')).toContainText('"count":42', {
      timeout: 5000,
    });
  });

  test('syncs bidirectionally', async ({ context }) => {
    const page_a = await context.newPage();
    const page_b = await context.newPage();

    await page_a.goto(PAGE_URL);
    await page_b.goto(PAGE_URL);

    await expect(page_a.locator('#status')).toHaveText('ready');
    await expect(page_b.locator('#status')).toHaveText('ready');

    await page_a.evaluate(() => {
      (window as any).__tabSync.set('count', 10);
    });
    await expect(page_b.locator('#state-display')).toContainText('"count":10', {
      timeout: 5000,
    });

    await page_b.evaluate(() => {
      (window as any).__tabSync.set('theme', 'dark');
    });
    await expect(page_a.locator('#state-display')).toContainText('"theme":"dark"', {
      timeout: 5000,
    });
  });

  test('patch syncs multiple keys at once', async ({ context }) => {
    const page_a = await context.newPage();
    const page_b = await context.newPage();

    await page_a.goto(PAGE_URL);
    await page_b.goto(PAGE_URL);

    await expect(page_a.locator('#status')).toHaveText('ready');
    await expect(page_b.locator('#status')).toHaveText('ready');

    await page_a.evaluate(() => {
      (window as any).__tabSync.patch({ count: 100, theme: 'dark' });
    });

    await expect(page_b.locator('#state-display')).toContainText('"count":100', {
      timeout: 5000,
    });
    await expect(page_b.locator('#state-display')).toContainText('"theme":"dark"');
  });
});
