# Redis 错误处理和确认对话框实现指南

## 概述

本文档描述了 Redis 管理功能中实现的错误处理和确认对话框功能，满足 Requirements 8.1, 8.2, 8.3, 8.4。

## 实现的功能

### 1. 统一错误处理 (Requirement 8.2)

**文件**: `admin-mit-ui/src/utils/redisErrorHandler.ts`

#### 错误类型识别
系统能够识别以下 Redis 错误类型：
- `CONNECTION_FAILED`: 连接失败
- `CONNECTION_TIMEOUT`: 连接超时
- `CONNECTION_LOST`: 连接断开
- `AUTH_FAILED`: 认证失败
- `KEY_NOT_FOUND`: 键不存在
- `OPERATION_FAILED`: 操作失败
- `INVALID_DATA`: 数据格式错误
- `PERMISSION_DENIED`: 权限不足
- `NETWORK_ERROR`: 网络错误
- `UNKNOWN_ERROR`: 未知错误

#### 错误解析函数
```typescript
parseRedisError(error: any): RedisError
```
- 自动识别错误类型
- 提取错误消息
- 判断是否可重试
- 判断是否可重连

#### 错误显示函数
```typescript
showRedisError(error: any, context?: string): RedisError
```
- 根据错误类型显示不同级别的提示（error/warning）
- 添加操作上下文信息
- 使用 Toast 组件显示用户友好的错误消息

### 2. 连接断开提示和重连 (Requirement 8.1, 8.3)

**文件**: `admin-mit-ui/src/components/RedisConnectionError/index.tsx`

#### 功能特性
- 显眼的连接断开提示（顶部居中，橙色警告样式）
- 显示连接名称和错误详情
- 提供"重新连接"按钮
- 提供"关闭"按钮（用户可选择稍后处理）
- 重连过程中显示加载状态

#### 使用示例
```typescript
<RedisConnectionError
  isVisible={showConnectionError}
  connectionName={connection.name}
  errorMessage={errorMessage}
  onReconnect={handleReconnect}
  onDismiss={handleDismiss}
/>
```

#### 集成位置
- `KeyBrowser.tsx`: 键浏览器中检测连接错误
- 其他需要连接的组件可以类似集成

### 3. 危险操作二次确认 (Requirement 8.4)

**文件**: `admin-mit-ui/src/components/ConfirmDialog/index.tsx`

#### 功能特性
- 统一的确认对话框组件
- 支持三种类型：danger（危险）、warning（警告）、info（信息）
- 显示操作标题、消息和警告文本
- 自定义确认和取消按钮文本
- 支持异步操作（显示加载状态）

#### 危险操作消息生成
```typescript
getDangerousActionMessage(options: DangerousActionOptions): {
  title: string
  message: string
  warning: string
}
```

支持的选项：
- `actionName`: 操作名称（如"删除"）
- `targetName`: 目标名称（如连接名或键名）
- `targetCount`: 目标数量（批量操作）
- `additionalWarning`: 额外警告信息

#### 使用示例
```typescript
<ConfirmDialog
  isOpen={showDeleteConfirm}
  onClose={handleCancel}
  onConfirm={handleConfirm}
  title="确认删除"
  message="确定要删除连接 'my-redis' 吗？"
  warning="此操作不可恢复，请谨慎操作。"
  confirmText="确认删除"
  type="danger"
/>
```

#### 已集成的危险操作
1. **删除连接** (`ConnectionList.tsx`)
   - 显示连接名称
   - 警告操作不可恢复

2. **删除键** (`KeyBrowser.tsx`)
   - 显示删除数量
   - 警告操作不可恢复
   - 支持批量删除

### 4. 操作失败错误提示 (Requirement 8.2)

#### 实现方式
所有 Redis 操作都使用 `showRedisError()` 函数处理错误：

```typescript
try {
  await redisService.someOperation()
} catch (error) {
  showRedisError(error, '操作上下文')
}
```

#### 错误提示特性
- 自动识别错误类型
- 显示具体的错误信息
- 根据错误严重程度选择提示类型（error/warning）
- 5秒自动关闭（错误）或 3秒（警告）

### 5. 网络超时处理 (Requirement 8.3)

#### 超时检测
```typescript
isNetworkError(error: any): boolean
isConnectionError(error: any): boolean
```

#### 重试机制
```typescript
executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T>
```

支持的选项：
- `maxAttempts`: 最大重试次数
- `delayMs`: 重试延迟（毫秒）
- `backoff`: 是否使用指数退避
- `onRetry`: 重试回调函数

## 测试场景

### 场景 1: 连接失败
1. 配置一个无效的 Redis 连接
2. 尝试连接
3. **预期**: 显示连接失败错误，提供重试选项

### 场景 2: 连接断开
1. 连接到 Redis 后，停止 Redis 服务
2. 尝试执行键操作
3. **预期**: 显示连接断开提示，提供重连按钮

### 场景 3: 删除连接
1. 点击删除连接按钮
2. **预期**: 显示确认对话框，包含连接名称和警告信息
3. 点击确认后执行删除

### 场景 4: 批量删除键
1. 选择多个键
2. 点击删除按钮
3. **预期**: 显示确认对话框，显示删除数量
4. 点击确认后执行批量删除

### 场景 5: 操作失败
1. 尝试设置无效的键值
2. **预期**: 显示具体的错误信息（如"数据格式不正确"）

### 场景 6: 权限不足
1. 使用无权限的用户尝试删除操作
2. **预期**: 显示权限不足警告

## 代码集成示例

### 在新组件中集成错误处理

```typescript
import { showRedisError, isConnectionError } from '../../utils/redisErrorHandler'
import { RedisConnectionError } from '../../components/RedisConnectionError'
import { ConfirmDialog } from '../../components/ConfirmDialog'

// 在组件状态中添加
const [showConnectionError, setShowConnectionError] = useState(false)
const [connectionError, setConnectionError] = useState<string | null>(null)

// 在操作中使用
try {
  await redisService.someOperation()
} catch (error) {
  if (isConnectionError(error)) {
    setShowConnectionError(true)
    setConnectionError(error.message)
  } else {
    showRedisError(error, '操作名称')
  }
}

// 在 JSX 中渲染
<RedisConnectionError
  isVisible={showConnectionError}
  connectionName={connection.name}
  errorMessage={connectionError || ''}
  onReconnect={handleReconnect}
  onDismiss={() => setShowConnectionError(false)}
/>
```

## 文件清单

### 新增文件
1. `admin-mit-ui/src/utils/redisErrorHandler.ts` - 错误处理工具
2. `admin-mit-ui/src/components/ConfirmDialog/index.tsx` - 确认对话框组件
3. `admin-mit-ui/src/components/RedisConnectionError/index.tsx` - 连接错误提示组件

### 修改文件
1. `admin-mit-ui/src/pages/Redis/ConnectionList.tsx` - 集成确认对话框和错误处理
2. `admin-mit-ui/src/pages/Redis/KeyBrowser.tsx` - 集成连接错误提示和确认对话框
3. `admin-mit-ui/src/pages/Redis/KeyDetail.tsx` - 集成错误处理
4. `admin-mit-ui/src/pages/Redis/index.tsx` - 集成错误处理

## 验证清单

- [x] 错误类型正确识别和分类
- [x] 连接断开时显示提示和重连选项
- [x] 危险操作显示二次确认对话框
- [x] 操作失败显示具体错误信息
- [x] 网络超时提供重试选项
- [x] 所有组件无 TypeScript 编译错误
- [x] 确认对话框支持不同类型（danger/warning/info）
- [x] 错误提示自动关闭
- [x] 重连过程显示加载状态

## 总结

本实现完全满足 Requirements 8.1, 8.2, 8.3, 8.4 的要求：
- ✅ 8.1: 连接断开提示和重连选项
- ✅ 8.2: 操作失败显示具体错误信息
- ✅ 8.3: 网络超时提示和重试
- ✅ 8.4: 危险操作二次确认

所有错误处理都遵循统一的模式，提供了良好的用户体验和清晰的错误反馈。
