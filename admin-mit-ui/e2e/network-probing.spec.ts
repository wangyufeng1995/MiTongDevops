import { test, expect } from '@playwright/test';

/**
 * 网络探测配置和监控 E2E 测试
 */

test.describe('网络探测流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够创建探测分组', async ({ page }) => {
    await page.goto('/network/groups');
    
    await page.click('[data-testid="add-group-button"]');
    await page.fill('input[name="name"]', 'HTTP探测分组');
    await page.fill('textarea[name="description"]', '用于HTTP探测的分组');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够创建网络探测任务', async ({ page }) => {
    await page.goto('/network/probes');
    
    await page.click('[data-testid="add-probe-button"]');
    await page.fill('input[name="name"]', 'HTTP探测');
    await page.select('select[name="protocol"]', 'http');
    await page.fill('input[name="target_url"]', 'http://example.com');
    await page.select('select[name="method"]', 'GET');
    await page.fill('input[name="timeout"]', '30');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够执行主动探测', async ({ page }) => {
    await page.goto('/network/probes');
    
    await page.click('tbody tr:first-child [data-testid="manual-probe"]');
    
    // 等待探测结果
    await expect(page.locator('.probe-result')).toBeVisible({ timeout: 10000 });
  });

  test('应该能够启动自动探测', async ({ page }) => {
    await page.goto('/network/probes');
    
    await page.click('tbody tr:first-child [data-testid="start-auto-probe"]');
    
    // 验证自动探测已启动
    await expect(page.locator('.auto-probe-status')).toHaveText('运行中');
  });

  test('应该能够查看探测结果', async ({ page }) => {
    await page.goto('/network/probes');
    
    await page.click('tbody tr:first-child [data-testid="view-results"]');
    
    // 验证结果列表显示（分页，每页10条）
    await expect(page.locator('table')).toBeVisible();
  });

  test('应该能够查看网络监控大屏', async ({ page }) => {
    await page.goto('/network/dashboard');
    
    await expect(page.locator('.dashboard-grid')).toBeVisible();
  });
});
