import { test, expect } from '@playwright/test';

/**
 * 监控告警配置和触发 E2E 测试
 */

test.describe('监控告警流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够创建告警渠道', async ({ page }) => {
    await page.goto('/monitor/channels');
    
    await page.click('[data-testid="add-channel-button"]');
    await page.fill('input[name="name"]', '测试邮箱渠道');
    await page.select('select[name="type"]', 'email');
    
    // 填写邮箱配置
    await page.fill('input[name="config.smtp_server"]', 'smtp.gmail.com');
    await page.fill('input[name="config.smtp_port"]', '587');
    await page.fill('input[name="config.username"]', 'test@gmail.com');
    await page.fill('input[name="config.password"]', 'password');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够创建告警规则', async ({ page }) => {
    await page.goto('/monitor/rules');
    
    await page.click('[data-testid="add-rule-button"]');
    await page.fill('input[name="name"]', 'CPU告警规则');
    await page.select('select[name="metric_type"]', 'cpu');
    await page.select('select[name="condition_operator"]', '>');
    await page.fill('input[name="threshold_value"]', '80');
    
    // 选择告警渠道
    await page.check('input[name="channels"][value="1"]');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够查看告警历史', async ({ page }) => {
    await page.goto('/monitor/alerts');
    
    await expect(page.locator('table')).toBeVisible();
  });

  test('应该能够查看监控大屏', async ({ page }) => {
    await page.goto('/monitor/dashboard');
    
    await expect(page.locator('.dashboard-grid')).toBeVisible();
    await expect(page.locator('.stat-card')).toHaveCount(4, { timeout: 5000 });
  });
});
