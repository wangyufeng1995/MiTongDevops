import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useAppStore } from '../../store/app'
import { authService } from '../../services/auth'
import { passwordEncryptService } from '../../services/password'

export const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { setLoading: setGlobalLoading } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setGlobalLoading(true)
    setError('')

    try {
      // 验证表单
      if (!formData.username.trim()) {
        throw new Error('请输入用户名')
      }
      if (!formData.password.trim()) {
        throw new Error('请输入密码')
      }

      // 临时禁用密码加密（开发模式）
      // TODO: 修复RSA加密问题后重新启用
      const encryptedPassword = formData.password
      console.log('Development mode: using plaintext password')
      
      // 登录请求
      const response = await authService.login({
        username: formData.username.trim(),
        password: encryptedPassword,
      })

      const { access_token, refresh_token, user, tenant } = response
      
      // 保存登录状态
      login(access_token, refresh_token, user, tenant)
      
      // 记住我功能
      if (rememberMe) {
        localStorage.setItem('remembered_username', formData.username.trim())
      } else {
        localStorage.removeItem('remembered_username')
      }
      
      // 跳转到仪表盘
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      console.error('Login error:', err)
      
      let errorMessage = '登录失败，请稍后重试'
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
      setGlobalLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
    
    // 清除错误信息
    if (error) {
      setError('')
    }
  }

  // 组件挂载时检查记住的用户名
  React.useEffect(() => {
    const rememberedUsername = localStorage.getItem('remembered_username')
    if (rememberedUsername) {
      setFormData(prev => ({ ...prev, username: rememberedUsername }))
      setRememberMe(true)
    }
  }, [])

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: 'url(/background.png)',
        backgroundColor: '#f0f4f8' // 备用背景色
      }}
    >
      {/* 半透明遮罩层，提升表单可读性 */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* 头部 */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">MT</span>
          </div>
          <h2 className="text-3xl font-bold text-white drop-shadow-lg">
            MiTong运维平台
          </h2>
          <p className="mt-2 text-sm text-white/90 drop-shadow">
            请登录您的账户以继续
          </p>
        </div>
        
        {/* 登录表单 - 毛玻璃效果 */}
        <div className="bg-white/20 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl border border-white/30">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* 错误提示 */}
            {error && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-300/50 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-100" />
                  <div className="ml-3">
                    <p className="text-sm text-white font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 用户名 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white mb-2">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full px-4 py-3 bg-white/30 backdrop-blur-sm border border-white/40 rounded-lg shadow-sm placeholder-white/60 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                placeholder="请输入用户名"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            
            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 pr-12 bg-white/30 backdrop-blur-sm border border-white/40 rounded-lg shadow-sm placeholder-white/60 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-white/70 hover:text-white transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-white/70 hover:text-white transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* 记住我 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-500 focus:ring-blue-400 border-white/40 rounded bg-white/20"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-white/90">
                  记住用户名
                </label>
              </div>
              
              <div className="text-sm">
                <a href="#" className="font-medium text-blue-200 hover:text-white transition-colors">
                  忘记密码？
                </a>
              </div>
            </div>

            {/* 登录按钮 */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    登录中...
                  </div>
                ) : (
                  '登录'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 底部信息 */}
        <div className="text-center text-xs text-white/70 drop-shadow">
          <p>© 2024 MiTong运维平台. 保留所有权利.</p>
        </div>
      </div>
    </div>
  )
}