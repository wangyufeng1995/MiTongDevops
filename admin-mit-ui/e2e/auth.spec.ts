import { test, expect } from '@playwright/test';

/**
 * 用户认证 E2E 测试
 * 测试登录、登出和 token 刷新流程
 */

test.describe('用户认证流程', () => {
  test('应该能够成功登录', async ({ page }) => {
    // 访问登录页面
    await page.goto('/login');
    
    // 填写登录表单
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    
    // 点击登录按钮
    await page.click('button[type="submit"]');
    
    // 等待跳转到首页
    await page.waitForURL('/dashboard');
    
    // 验证登录成功
    await expect(page).toHaveURL('/dashboard');
  });

  test('应该显示错误信息当密码错误时', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // 验证显示错误信息
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('应该能够成功登出', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // 点击登出按钮
    await page.click('[data-testid="logout-button"]');
    
    // 验证跳转到登录页
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});
