import React, { useState } from 'react'
import { RefreshCw, Copy, Check } from 'lucide-react'
import { passwordEncryptService } from '../../services/password'
import { copyToClipboard } from '../../utils'

interface PasswordGeneratorProps {
  onPasswordGenerated?: (password: string) => void
  className?: string
  defaultLength?: number
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({
  onPasswordGenerated,
  className = '',
  defaultLength = 12
}) => {
  const [password, setPassword] = useState('')
  const [length, setLength] = useState(defaultLength)
  const [copied, setCopied] = useState(false)

  const generatePassword = () => {
    const newPassword = passwordEncryptService.generateSecurePassword(length)
    setPassword(newPassword)
    onPasswordGenerated?.(newPassword)
  }

  const handleCopy = async () => {
    if (password) {
      const success = await copyToClipboard(password)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLength = parseInt(e.target.value)
    setLength(newLength)
    if (password) {
      // 重新生成密码以匹配新长度
      const newPassword = passwordEncryptService.generateSecurePassword(newLength)
      setPassword(newPassword)
      onPasswordGenerated?.(newPassword)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 长度控制 */}
      <div className="flex items-center space-x-3">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
          密码长度:
        </label>
        <input
          type="range"
          min="8"
          max="32"
          value={length}
          onChange={handleLengthChange}
          className="flex-1"
        />
        <span className="text-sm text-gray-600 w-8 text-center">{length}</span>
      </div>

      {/* 生成按钮 */}
      <div className="flex space-x-2">
        <button
          type="button"
          onClick={generatePassword}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>生成密码</span>
        </button>
      </div>

      {/* 生成的密码 */}
      {password && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={password}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`p-2 rounded-md transition-colors ${
                copied
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={copied ? '已复制' : '复制密码'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* 密码强度显示 */}
          <div className="text-xs text-gray-600">
            {(() => {
              const validation = passwordEncryptService.validatePasswordStrength(password)
              return (
                <span className={validation.isValid ? 'text-green-600' : 'text-orange-600'}>
                  强度: {validation.score}/5 {validation.isValid ? '(符合要求)' : '(建议增强)'}
                </span>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

export default PasswordGenerator