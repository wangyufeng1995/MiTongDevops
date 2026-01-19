# MiTong 运维平台 - 前端项目

基于 React 18 + TypeScript + Vite + Tailwind CSS 的现代化前端项目。

## 🚀 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 4.x
- **样式**: Tailwind CSS 3.x
- **状态管理**: Zustand
- **路由**: React Router v6
- **HTTP 客户端**: Axios
- **头像库**: DiceBear
- **密码加密**: JSEncrypt
- **图标**: Lucide React
- **测试**: Vitest + React Testing Library
- **代码规范**: ESLint + Prettier

## 📁 项目结构

```
src/
├── assets/          # 静态资源（图片、图标、样式）
├── components/      # 可复用组件
│   ├── Avatar/      # 头像组件
│   └── Layout/      # 布局组件
├── layouts/         # 页面布局
├── pages/           # 页面组件
│   ├── Dashboard/   # 仪表盘
│   └── Login/       # 登录页面
├── router/          # 路由配置
├── services/        # API 服务和业务逻辑
│   ├── api.ts       # API 客户端
│   ├── auth.ts      # 认证服务
│   ├── avatar.ts    # 头像服务
│   ├── csrf.ts      # CSRF 保护
│   └── password.ts  # 密码加密
├── store/           # 状态管理
│   ├── app.ts       # 应用状态
│   └── auth.ts      # 认证状态
├── types/           # TypeScript 类型定义
│   ├── api.ts       # API 类型
│   ├── auth.ts      # 认证类型
│   ├── common.ts    # 通用类型
│   ├── index.ts     # 类型导出
│   └── user.ts      # 用户类型
├── utils/           # 工具函数
├── test/            # 测试配置
├── App.tsx          # 根组件
├── main.tsx         # 应用入口
└── index.css        # 全局样式
```

## 🛠️ 开发环境

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 🧪 测试

### 运行测试

```bash
npm run test
```

### 运行测试并生成覆盖率报告

```bash
npm run test:coverage
```

### 代码检查

```bash
npm run lint
```

## 🔧 配置

### 环境变量

复制 `.env.example` 到 `.env` 并配置相应的环境变量：

```bash
# API 基础地址
VITE_API_BASE_URL=http://localhost:5000

# 应用标题
VITE_APP_TITLE=MiTong运维平台

# 是否启用开发模式
VITE_DEV_MODE=true
```

### 代理配置

开发环境下，API 请求会自动代理到后端服务器（默认 http://localhost:5000）。

配置位于 `vite.config.ts`：

```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
  },
}
```

## 🎨 主要功能

### 1. 认证系统

- JWT Token 认证
- 自动 Token 刷新
- 密码 RSA 加密传输
- CSRF 保护

### 2. 头像系统

- DiceBear 头像库集成
- 多种头像风格支持
- 头像编辑器
- 随机头像生成

### 3. 状态管理

使用 Zustand 进行轻量级状态管理：

```typescript
// 认证状态
const { user, token, login, logout } = useAuthStore()

// 应用状态
const { theme, setTheme, notifications } = useAppStore()
```

### 4. API 客户端

统一的 API 客户端，支持：

- 自动添加 JWT Token
- 自动 CSRF 保护
- 请求/响应拦截
- 错误处理
- Token 自动刷新

```typescript
import { api } from '@/services/api'

// GET 请求
const users = await api.get('/api/users')

// POST 请求
const user = await api.post('/api/users', userData)
```

### 5. 工具函数

提供丰富的工具函数：

```typescript
import {
  formatDateTime,
  formatFileSize,
  debounce,
  throttle,
  deepClone,
  copyToClipboard
} from '@/utils'
```

## 🎯 开发规范

### 组件开发

1. 使用函数式组件 + Hooks
2. 组件文件使用 PascalCase 命名
3. 导出默认组件和命名组件
4. 添加 TypeScript 类型定义
5. 编写单元测试

```typescript
interface ComponentProps {
  title: string
  onAction?: () => void
}

const Component: React.FC<ComponentProps> = ({ title, onAction }) => {
  return (
    <div className="component">
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  )
}

export default Component
```

### 样式规范

1. 优先使用 Tailwind CSS 类
2. 自定义样式使用 CSS Modules 或 styled-components
3. 响应式设计优先
4. 遵循设计系统规范

### 测试规范

1. 组件测试覆盖主要功能
2. 服务测试覆盖业务逻辑
3. 工具函数测试覆盖边界情况
4. 保持测试覆盖率 > 80%

## 📦 构建和部署

### Docker 部署

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 静态部署

构建后的文件位于 `dist/` 目录，可以部署到任何静态文件服务器。

## 🔍 故障排查

### 常见问题

1. **API 请求失败**
   - 检查后端服务是否启动
   - 确认 API 地址配置正确
   - 查看浏览器网络面板

2. **CSRF 错误**
   - 确认后端 CSRF 配置正确
   - 检查 Cookie 设置
   - 验证 CSRF Token 获取

3. **头像显示异常**
   - 检查网络连接
   - 确认 DiceBear API 可访问
   - 查看控制台错误信息

### 调试工具

- React Developer Tools
- Redux DevTools (for Zustand)
- Network 面板
- Console 日志

## 📚 相关文档

- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Vite 官方文档](https://vitejs.dev/)
- [Tailwind CSS 官方文档](https://tailwindcss.com/)
- [Zustand 官方文档](https://github.com/pmndrs/zustand)
- [DiceBear 官方文档](https://www.dicebear.com/)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License