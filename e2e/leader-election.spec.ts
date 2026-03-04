import { test, expect } from '@playwright/test';

const PAGE_URL = '/e2e/fixtures/test-page.html';

test.describe('Leader Election E2E', () => {
  test('elects a leader among multiple tabs', async ({ context }) => {
    const page_a = await context.newPage();
    await page_a.goto(PAGE_URL);
    await expect(page_a.locator('#status')).toHaveText('ready');

    const page_b = await context.newPage();
    await page_b.goto(PAGE_URL);
    await expect(page_b.locator('#status')).toHaveText('ready');

    await page_a.waitForTimeout(3000);

    const leader_a = await page_a.locator('#leader-status').textContent();
    const leader_b = await page_b.locator('#leader-status').textContent();

    const leader_count = [leader_a, leader_b].filter((s) => s === 'true').length;
    expect(leader_count).toBe(1);
  });

  test('tab count updates when new tab joins', async ({ context }) => {
    const page_a = await context.newPage();
    await page_a.goto(PAGE_URL);
    await expect(page_a.locator('#status')).toHaveText('ready');

    const page_b = await context.newPage();
    await page_b.goto(PAGE_URL);
    await expect(page_b.locator('#status')).toHaveText('ready');

    await expect(page_a.locator('#tab-count')).toHaveText('2', { timeout: 5000 });
    await expect(page_b.locator('#tab-count')).toHaveText('2', { timeout: 5000 });
  });

  test('failover: new leader elected when leader tab closes', async ({ context }) => {
    const page_a = await context.newPage();
    await page_a.goto(PAGE_URL);
    await expect(page_a.locator('#status')).toHaveText('ready');

    const page_b = await context.newPage();
    await page_b.goto(PAGE_URL);
    await expect(page_b.locator('#status')).toHaveText('ready');

    await page_a.waitForTimeout(3000);

    const leader_a = await page_a.locator('#leader-status').textContent();
    const leader_b = await page_b.locator('#leader-status').textContent();

    if (leader_a === 'true') {
      await page_a.close();
      await page_b.waitForTimeout(8000);
      const new_leader = await page_b.locator('#leader-status').textContent();
      expect(new_leader).toBe('true');
    } else {
      await page_b.close();
      await page_a.waitForTimeout(8000);
      const new_leader = await page_a.locator('#leader-status').textContent();
      expect(new_leader).toBe('true');
    }
  });
});
