import { test, expect } from '@playwright/test';

const PAGE_URL = '/e2e/fixtures/test-page.html';

test.describe('RPC Cross-Tab E2E', () => {
  test('calls an RPC handler on another tab', async ({ context }) => {
    const page_a = await context.newPage();
    const page_b = await context.newPage();

    await page_a.goto(PAGE_URL);
    await page_b.goto(PAGE_URL);

    await expect(page_a.locator('#status')).toHaveText('ready');
    await expect(page_b.locator('#status')).toHaveText('ready');

    await page_a.waitForTimeout(1000);

    const tab_b_id = await page_b.evaluate(() => (window as any).__tabSync.id);

    await page_b.evaluate(() => {
      (window as any).__tabSync.handle('add', ({ a, b }: { a: number; b: number }) => a + b);
    });

    const result = await page_a.evaluate(async (target_id) => {
      return await (window as any).__tabSync.call(target_id, 'add', { a: 3, b: 7 });
    }, tab_b_id);

    expect(result).toBe(10);
  });

  test('calls RPC on leader tab', async ({ context }) => {
    const page_a = await context.newPage();
    const page_b = await context.newPage();

    await page_a.goto(PAGE_URL);
    await page_b.goto(PAGE_URL);

    await expect(page_a.locator('#status')).toHaveText('ready');
    await expect(page_b.locator('#status')).toHaveText('ready');

    await page_a.waitForTimeout(3000);

    const leader_a = await page_a.locator('#leader-status').textContent();
    const leader_page = leader_a === 'true' ? page_a : page_b;
    const caller_page = leader_a === 'true' ? page_b : page_a;

    await leader_page.evaluate(() => {
      (window as any).__tabSync.handle('getTime', () => 'server-time-123');
    });

    const result = await caller_page.evaluate(async () => {
      return await (window as any).__tabSync.call('leader', 'getTime');
    });

    expect(result).toBe('server-time-123');
  });

  test('callAll fans out to all other tabs', async ({ context }) => {
    const page_a = await context.newPage();
    const page_b = await context.newPage();
    const page_c = await context.newPage();

    await page_a.goto(PAGE_URL);
    await page_b.goto(PAGE_URL);
    await page_c.goto(PAGE_URL);

    await expect(page_a.locator('#status')).toHaveText('ready');
    await expect(page_b.locator('#status')).toHaveText('ready');
    await expect(page_c.locator('#status')).toHaveText('ready');

    await page_a.waitForTimeout(1500);

    await page_b.evaluate(() => {
      (window as any).__tabSync.handle('ping', () => 'pong-b');
    });
    await page_c.evaluate(() => {
      (window as any).__tabSync.handle('ping', () => 'pong-c');
    });

    const results = await page_a.evaluate(async () => {
      return await (window as any).__tabSync.callAll('ping');
    });

    expect(results).toHaveLength(2);
    const result_values = results.map((r: any) => r.result).sort();
    expect(result_values).toEqual(['pong-b', 'pong-c']);
  });
});
