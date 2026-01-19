import { test, expect } from '@playwright/test';

/**
 * 主机管理和 WebShell E2E 测试
 */

test.describe('主机管理流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够添加新主机', async ({ page }) => {
    await page.goto('/hosts');
    
    await page.click('[data-testid="add-host-button"]');
    await page.fill('input[name="name"]', 'test-server');
    await page.fill('input[name="hostname"]', '192.168.1.100');
    await page.fill('input[name="port"]', '22');
    await page.fill('input[name="username"]', 'root');
    await page.select('select[name="auth_type"]', 'password');
    await page.fill('input[name="password"]', 'password123');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够测试主机连接', async ({ page }) => {
    await page.goto('/hosts');
    
    await page.click('tbody tr:first-child [data-testid="test-connection"]');
    
    // 等待连接测试结果
    await expect(page.locator('.connection-result')).toBeVisible({ timeout: 10000 });
  });

  test('应该能够查看主机详情', async ({ page }) => {
    await page.goto('/hosts');
    
    await page.click('tbody tr:first-child [data-testid="view-details"]');
    
    // 验证主机详情页面
    await expect(page.locator('.host-details')).toBeVisible();
  });
});
