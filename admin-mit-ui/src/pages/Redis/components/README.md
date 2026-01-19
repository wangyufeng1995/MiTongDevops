# Redis 数据类型编辑器

本目录包含 Redis 各种数据类型的可视化编辑器组件。

## 组件列表

### 1. StringEditor.tsx
- **功能**: String 类型键值的查看和编辑
- **需求**: Requirements 4.2, 4.3
- **特性**:
  - 文本编辑器，支持大文本
  - 显示字节大小和字符数
  - 复制功能
  - 实时保存状态提示

### 2. HashEditor.tsx
- **功能**: Hash 类型键值的查看和编辑
- **需求**: Requirements 4.4
- **特性**:
  - 字段-值对管理
  - 添加、修改、删除字段
  - 搜索功能（超过5个字段时显示）
  - 内联编辑支持

### 3. ListEditor.tsx
- **功能**: List 类型键值的查看和编辑
- **需求**: Requirements 4.5
- **特性**:
  - 有序列表元素管理
  - 支持从头部或尾部添加元素
  - 元素上移/下移功能
  - 删除指定元素

### 4. SetEditor.tsx
- **功能**: Set 类型键值的查看和编辑
- **需求**: Requirements 4.6
- **特性**:
  - 无序集合成员管理
  - 自动去重（不允许重复成员）
  - 搜索功能（超过5个成员时显示）
  - 添加、删除成员

### 5. ZSetEditor.tsx
- **功能**: ZSet (Sorted Set) 类型键值的查看和编辑
- **需求**: Requirements 4.7
- **特性**:
  - 有序集合成员及分数管理
  - 按分数升序/降序排序
  - 添加、修改、删除成员及分数
  - 搜索功能（支持搜索成员和分数）
  - 内联编辑支持

## 通用特性

所有编辑器都支持以下通用特性：

1. **只读模式**: 通过 `readOnly` 属性控制
2. **保存回调**: 通过 `onSave` 属性提供保存功能
3. **刷新回调**: 通过 `onRefresh` 属性提供刷新功能
4. **Toast 提示**: 操作成功/失败的即时反馈
5. **脏数据检测**: 显示未保存的更改状态
6. **错误处理**: 友好的错误提示

## 使用示例

```typescript
import { StringEditor, HashEditor, ListEditor, SetEditor, ZSetEditor } from './components'

// String 编辑器
<StringEditor
  connectionId={1}
  keyName="mykey"
  initialValue="Hello Redis"
  onSave={async (value) => {
    await redisService.updateKey(1, 'mykey', { value })
  }}
  onRefresh={async () => {
    // 重新加载数据
  }}
/>

// Hash 编辑器
<HashEditor
  connectionId={1}
  keyName="user:1"
  initialValue={{ name: 'John', age: '30' }}
  onSave={async (value) => {
    await redisService.updateKey(1, 'user:1', { value })
  }}
/>

// List 编辑器
<ListEditor
  connectionId={1}
  keyName="mylist"
  initialValue={['item1', 'item2', 'item3']}
  onSave={async (value) => {
    await redisService.updateKey(1, 'mylist', { value })
  }}
/>

// Set 编辑器
<SetEditor
  connectionId={1}
  keyName="myset"
  initialValue={['member1', 'member2', 'member3']}
  onSave={async (value) => {
    await redisService.updateKey(1, 'myset', { value })
  }}
/>

// ZSet 编辑器
<ZSetEditor
  connectionId={1}
  keyName="myzset"
  initialValue={[
    { member: 'player1', score: 100 },
    { member: 'player2', score: 95 }
  ]}
  onSave={async (value) => {
    await redisService.updateKey(1, 'myzset', { value })
  }}
/>
```

## 集成到 KeyDetail 组件

这些编辑器可以集成到 `KeyDetail.tsx` 组件中，根据键类型动态渲染相应的编辑器：

```typescript
// 在 KeyDetail.tsx 中
import { StringEditor, HashEditor, ListEditor, SetEditor, ZSetEditor } from './components'

// 根据键类型渲染编辑器
{keyDetail.type === 'string' && (
  <StringEditor
    connectionId={connection.id}
    keyName={keyInfo.key}
    initialValue={keyDetail.value}
    readOnly={!hasPermission('redis:update')}
    onSave={handleSave}
    onRefresh={loadKeyDetail}
  />
)}

{keyDetail.type === 'hash' && (
  <HashEditor
    connectionId={connection.id}
    keyName={keyInfo.key}
    initialValue={keyDetail.value}
    readOnly={!hasPermission('redis:update')}
    onSave={handleSave}
    onRefresh={loadKeyDetail}
  />
)}

// ... 其他类型类似
```

## 样式说明

所有编辑器使用 Tailwind CSS 进行样式设计，并与现有系统保持一致的视觉风格：

- **String**: 绿色主题
- **Hash**: 红色主题
- **List**: 蓝色主题
- **Set**: 紫色主题
- **ZSet**: 橙色主题

## 注意事项

1. 所有编辑器都需要 `lucide-react` 图标库
2. 编辑器使用受控组件模式，状态由父组件管理
3. 保存操作是异步的，需要处理 Promise
4. 建议在使用前检查用户权限
