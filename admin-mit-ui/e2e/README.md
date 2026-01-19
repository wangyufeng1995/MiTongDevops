# E2E 测试套件

本目录包含使用 Playwright 编写的端到端测试。

## 测试覆盖范围

### 1. 用户认证 (auth.spec.ts)
- 用户登录流程
- 错误处理（错误密码）
- 用户登出流程

### 2. 用户管理 (user-management.spec.ts)
- 查看用户列表
- 创建新用户
- 编辑用户信息
- 删除用户
- 搜索用户

### 3. 角色管理 (role-management.spec.ts)
- 查看角色列表
- 创建新角色
- 分配权限

### 4. 主机管理 (host-management.spec.ts)
- 添加新主机
- 测试主机连接
- 查看主机详情

### 5. Ansible 管理 (ansible.spec.ts)
- 创建 Playbook
- 执行 Playbook
- 查看执行历史

### 6. 监控告警 (monitoring.spec.ts)
- 创建告警渠道
- 创建告警规则
- 查看告警历史
- 查看监控大屏

### 7. 网络探测 (network-probing.spec.ts)
- 创建探测分组
- 创建网络探测任务
- 执行主动探测
- 启动自动探测
- 查看探测结果
- 查看网络监控大屏

### 8. K8S运维管理 (k8s-management.spec.ts)
- K8S集群管理
  - 访问集群列表页面
  - 显示集群列表
  - 添加集群对话框
  - 验证集群表单必填字段
- K8S命名空间管理
  - 访问命名空间列表
  - 集群选择器
  - 命名空间搜索
- K8S工作负载管理
  - 访问工作负载列表
  - 工作负载类型切换
- K8S服务发现管理
  - 访问服务列表
  - 服务类型筛选
- K8S配置管理
  - 访问配置列表
  - ConfigMap和Secret切换
- K8S存储管理
  - 访问存储列表
  - 存储类型切换
- K8S错误处理
  - 连接错误提示
  - 权限不足提示
- K8S用户反馈
  - 加载状态显示
  - 操作成功提示
  - 空状态提示

## 运行测试

### 运行所有测试
```bash
npm run test:e2e
```

### 使用 UI 模式运行
```bash
npm run test:e2e:ui
```

### 查看测试报告
```bash
npm run test:e2e:report
```

### 运行特定测试文件
```bash
npx playwright test auth.spec.ts
```

### 运行特定浏览器
```bash
npx playwright test --project=chromium
```

## 测试配置

测试配置位于 `playwright.config.ts` 文件中。

### 主要配置项：
- **testDir**: 测试文件目录 (`./e2e`)
- **baseURL**: 应用基础 URL
- **trace**: 失败时记录追踪
- **screenshot**: 失败时截图
- **video**: 失败时录制视频
- **webServer**: 自动启动开发服务器

## 测试最佳实践

1. **使用 data-testid 属性**：为关键元素添加 `data-testid` 属性，便于定位
2. **等待元素可见**：使用 `waitForSelector` 或 `expect().toBeVisible()`
3. **独立测试**：每个测试应该独立运行，不依赖其他测试
4. **清理数据**：测试后清理创建的数据
5. **使用 beforeEach**：在每个测试前进行登录等通用操作

## 调试测试

### 使用 Playwright Inspector
```bash
npx playwright test --debug
```

### 查看测试追踪
```bash
npx playwright show-trace trace.zip
```

## CI/CD 集成

测试可以集成到 CI/CD 流程中：

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## 注意事项

1. 首次运行需要安装浏览器：`npx playwright install`
2. 确保后端服务正在运行
3. 测试数据应该使用测试数据库
4. 某些测试可能需要实际的 SSH 主机或网络服务
