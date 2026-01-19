import { test, expect } from '@playwright/test';

/**
 * Ansible 执行流程 E2E 测试
 */

test.describe('Ansible 管理流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够创建 Playbook', async ({ page }) => {
    await page.goto('/ansible/playbooks');
    
    await page.click('[data-testid="add-playbook-button"]');
    await page.fill('input[name="name"]', 'Test Playbook');
    await page.fill('textarea[name="description"]', 'Test playbook description');
    
    // 填写 YAML 内容
    const yamlContent = `---
- hosts: all
  tasks:
    - name: Test task
      debug:
        msg: "Hello World"`;
    
    await page.fill('.monaco-editor textarea', yamlContent);
    
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('应该能够执行 Playbook', async ({ page }) => {
    await page.goto('/ansible/playbooks');
    
    await page.click('tbody tr:first-child [data-testid="execute-button"]');
    
    // 选择目标主机
    await page.check('input[name="hosts"][value="1"]');
    
    // 点击执行
    await page.click('[data-testid="confirm-execute"]');
    
    // 验证执行开始
    await expect(page.locator('.execution-status')).toBeVisible();
  });

  test('应该能够查看执行历史', async ({ page }) => {
    await page.goto('/ansible/executions');
    
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 5000 });
  });
});
