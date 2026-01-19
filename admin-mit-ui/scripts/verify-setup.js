#!/usr/bin/env node

/**
 * 前端项目设置验证脚本
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

console.log('🔍 验证前端项目设置...\n')

// 检查必要的文件和目录
const requiredPaths = [
  // 配置文件
  'package.json',
  'vite.config.ts',
  'tailwind.config.js',
  'tsconfig.json',
  '.eslintrc.cjs',
  '.prettierrc',
  'vitest.config.ts',
  
  // 环境配置
  '.env.example',
  '.env',
  
  // 源代码目录
  'src',
  'src/components',
  'src/layouts',
  'src/pages',
  'src/router',
  'src/services',
  'src/store',
  'src/types',
  'src/utils',
  'src/test',
  'src/assets',
  
  // 关键文件
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  'src/test/setup.ts',
  
  // 服务文件
  'src/services/api.ts',
  'src/services/auth.ts',
  'src/services/avatar.ts',
  'src/services/csrf.ts',
  'src/services/password.ts',
  
  // 类型定义
  'src/types/index.ts',
  'src/types/api.ts',
  'src/types/auth.ts',
  'src/types/user.ts',
  'src/types/common.ts',
  
  // 工具函数
  'src/utils/index.ts',
  
  // 组件
  'src/components/Avatar/index.tsx',
  
  // 测试文件
  'src/services/__tests__/avatar.test.ts',
  'src/utils/__tests__/index.test.ts',
  'src/components/Avatar/__tests__/Avatar.test.tsx',
]

let allValid = true

console.log('📁 检查文件和目录结构:')
requiredPaths.forEach(relativePath => {
  const fullPath = path.join(projectRoot, relativePath)
  const exists = fs.existsSync(fullPath)
  const status = exists ? '✅' : '❌'
  console.log(`  ${status} ${relativePath}`)
  
  if (!exists) {
    allValid = false
  }
})

console.log('\n📦 检查 package.json 配置:')

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  
  // 检查必要的依赖
  const requiredDependencies = [
    'react',
    'react-dom',
    'react-router-dom',
    'zustand',
    'axios',
    '@dicebear/collection',
    '@dicebear/core',
    'jsencrypt',
    'clsx',
    'lucide-react'
  ]
  
  const requiredDevDependencies = [
    '@types/react',
    '@types/react-dom',
    '@vitejs/plugin-react',
    'typescript',
    'vite',
    'vitest',
    'tailwindcss',
    'eslint',
    'prettier',
    '@testing-library/react',
    '@testing-library/jest-dom',
    '@vitest/coverage-v8'
  ]
  
  requiredDependencies.forEach(dep => {
    const exists = packageJson.dependencies && packageJson.dependencies[dep]
    const status = exists ? '✅' : '❌'
    console.log(`  ${status} ${dep} ${exists ? `(${packageJson.dependencies[dep]})` : ''}`)
    
    if (!exists) {
      allValid = false
    }
  })
  
  requiredDevDependencies.forEach(dep => {
    const exists = packageJson.devDependencies && packageJson.devDependencies[dep]
    const status = exists ? '✅' : '❌'
    console.log(`  ${status} ${dep} ${exists ? `(${packageJson.devDependencies[dep]})` : ''}`)
    
    if (!exists) {
      allValid = false
    }
  })
  
  // 检查脚本
  console.log('\n📜 检查 npm 脚本:')
  const requiredScripts = ['dev', 'build', 'lint', 'preview', 'test', 'test:coverage']
  
  requiredScripts.forEach(script => {
    const exists = packageJson.scripts && packageJson.scripts[script]
    const status = exists ? '✅' : '❌'
    console.log(`  ${status} ${script} ${exists ? `(${packageJson.scripts[script]})` : ''}`)
    
    if (!exists) {
      allValid = false
    }
  })
  
} catch (error) {
  console.log('  ❌ 无法读取 package.json')
  allValid = false
}

console.log('\n🔧 检查配置文件:')

// 检查 TypeScript 配置
try {
  const tsConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'tsconfig.json'), 'utf8'))
  const hasReactJsx = tsConfig.compilerOptions && tsConfig.compilerOptions.jsx === 'react-jsx'
  console.log(`  ${hasReactJsx ? '✅' : '❌'} TypeScript React JSX 配置`)
  
  if (!hasReactJsx) {
    allValid = false
  }
} catch (error) {
  console.log('  ❌ TypeScript 配置无效')
  allValid = false
}

// 检查环境变量
try {
  const envExample = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8')
  const hasApiUrl = envExample.includes('VITE_API_BASE_URL')
  console.log(`  ${hasApiUrl ? '✅' : '❌'} 环境变量配置`)
  
  if (!hasApiUrl) {
    allValid = false
  }
} catch (error) {
  console.log('  ❌ 环境变量配置无效')
  allValid = false
}

console.log('\n🎯 功能特性检查:')

// 检查 DiceBear 头像服务
try {
  const avatarService = fs.readFileSync(path.join(projectRoot, 'src/services/avatar.ts'), 'utf8')
  const hasDiceBear = avatarService.includes('@dicebear/core') && avatarService.includes('createAvatar')
  console.log(`  ${hasDiceBear ? '✅' : '❌'} DiceBear 头像服务`)
  
  if (!hasDiceBear) {
    allValid = false
  }
} catch (error) {
  console.log('  ❌ DiceBear 头像服务配置无效')
  allValid = false
}

// 检查 API 客户端
try {
  const apiService = fs.readFileSync(path.join(projectRoot, 'src/services/api.ts'), 'utf8')
  const hasAxios = apiService.includes('axios') && apiService.includes('interceptors')
  const hasCSRF = apiService.includes('X-CSRFToken')
  console.log(`  ${hasAxios ? '✅' : '❌'} Axios API 客户端`)
  console.log(`  ${hasCSRF ? '✅' : '❌'} CSRF 保护`)
  
  if (!hasAxios || !hasCSRF) {
    allValid = false
  }
} catch (error) {
  console.log('  ❌ API 客户端配置无效')
  allValid = false
}

// 检查测试配置
try {
  const vitestConfig = fs.readFileSync(path.join(projectRoot, 'vitest.config.ts'), 'utf8')
  const hasJsdom = vitestConfig.includes('jsdom')
  const hasCoverage = vitestConfig.includes('coverage')
  console.log(`  ${hasJsdom ? '✅' : '❌'} Vitest + jsdom 测试环境`)
  console.log(`  ${hasCoverage ? '✅' : '❌'} 测试覆盖率配置`)
  
  if (!hasJsdom || !hasCoverage) {
    allValid = false
  }
} catch (error) {
  console.log('  ❌ 测试配置无效')
  allValid = false
}

console.log('\n' + '='.repeat(50))

if (allValid) {
  console.log('🎉 前端项目设置验证通过！')
  console.log('\n📋 下一步操作:')
  console.log('  1. 运行 npm install 安装依赖')
  console.log('  2. 运行 npm run dev 启动开发服务器')
  console.log('  3. 运行 npm run test 执行测试')
  console.log('  4. 运行 npm run build 构建生产版本')
  process.exit(0)
} else {
  console.log('❌ 前端项目设置验证失败！')
  console.log('\n请检查上述标记为 ❌ 的项目并修复。')
  process.exit(1)
}