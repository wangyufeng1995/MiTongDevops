import { test, expect } from '@playwright/test';

/**
 * 用户管理 E2E 测试
 * 测试用户的增删改查完整流程
 */

test.describe('用户管理流程', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够查看用户列表', async ({ page }) => {
    // 导航到用户管理页面
    await page.goto('/users');
    
    // 验证用户列表显示
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 5000 });
  });

  test('应该能够创建新用户', async ({ page }) => {
    await page.goto('/users');
    
    // 点击新增用户按钮
    await page.click('[data-testid="add-user-button"]');
    
    // 填写用户表单
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="full_name"]', 'Test User');
    await page.fill('input[name="password"]', 'password123');
    
    // 提交表单
    await page.click('button[type="submit"]');
    
    // 验证用户创建成功
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够编辑用户信息', async ({ page }) => {
    await page.goto('/users');
    
    // 点击编辑按钮
    await page.click('tbody tr:first-child [data-testid="edit-button"]');
    
    // 修改用户信息
    await page.fill('input[name="full_name"]', 'Updated Name');
    
    // 提交表单
    await page.click('button[type="submit"]');
    
    // 验证更新成功
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够删除用户', async ({ page }) => {
    await page.goto('/users');
    
    // 点击删除按钮
    await page.click('tbody tr:first-child [data-testid="delete-button"]');
    
    // 确认删除
    await page.click('[data-testid="confirm-delete"]');
    
    // 验证删除成功
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够搜索用户', async ({ page }) => {
    await page.goto('/users');
    
    // 输入搜索关键词
    await page.fill('input[name="search"]', 'admin');
    
    // 点击搜索按钮
    await page.click('[data-testid="search-button"]');
    
    // 验证搜索结果
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 5000 });
  });
});
