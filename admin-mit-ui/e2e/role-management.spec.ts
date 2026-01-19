import { test, expect } from '@playwright/test';

/**
 * 角色和权限管理 E2E 测试
 */

test.describe('角色管理流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够查看角色列表', async ({ page }) => {
    await page.goto('/roles');
    await expect(page.locator('table')).toBeVisible();
  });

  test('应该能够创建新角色', async ({ page }) => {
    await page.goto('/roles');
    
    await page.click('[data-testid="add-role-button"]');
    await page.fill('input[name="name"]', 'Test Role');
    await page.fill('textarea[name="description"]', 'Test role description');
    
    // 选择权限
    await page.check('input[name="permissions.users.read"]');
    await page.check('input[name="permissions.users.write"]');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够分配权限', async ({ page }) => {
    await page.goto('/roles');
    
    await page.click('tbody tr:first-child [data-testid="edit-button"]');
    
    // 修改权限
    await page.check('input[name="permissions.hosts.read"]');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
