import React from 'react'
import { passwordEncryptService } from '../../services/password'

interface PasswordStrengthProps {
  password: string
  className?: string
  showFeedback?: boolean
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  className = '',
  showFeedback = true
}) => {
  const validation = passwordEncryptService.validatePasswordStrength(password)
  
  const getStrengthColor = (score: number): string => {
    if (score <= 1) return 'bg-red-500'
    if (score <= 2) return 'bg-orange-500'
    if (score <= 3) return 'bg-yellow-500'
    if (score <= 4) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getStrengthText = (score: number): string => {
    if (score <= 1) return '很弱'
    if (score <= 2) return '弱'
    if (score <= 3) return '一般'
    if (score <= 4) return '强'
    return '很强'
  }

  const strengthPercentage = (validation.score / 5) * 100

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 强度条 */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(validation.score)}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${
          validation.isValid ? 'text-green-600' : 'text-red-600'
        }`}>
          {getStrengthText(validation.score)}
        </span>
      </div>

      {/* 反馈信息 */}
      {showFeedback && validation.feedback.length > 0 && (
        <div className="space-y-1">
          {validation.feedback.map((feedback, index) => (
            <p key={index} className="text-xs text-red-600 flex items-center">
              <span className="w-1 h-1 bg-red-600 rounded-full mr-2" />
              {feedback}
            </p>
          ))}
        </div>
      )}

      {/* 成功提示 */}
      {showFeedback && validation.isValid && validation.feedback.length === 0 && (
        <p className="text-xs text-green-600 flex items-center">
          <span className="w-1 h-1 bg-green-600 rounded-full mr-2" />
          密码强度符合要求
        </p>
      )}
    </div>
  )
}

export default PasswordStrength