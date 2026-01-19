import React, { useState, useEffect } from 'react'
import { clsx } from 'clsx'

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => string | null
  message?: string
}

export interface FormFieldProps {
  name: string
  label?: string
  children: React.ReactElement
  rules?: ValidationRule[]
  validateOn?: 'change' | 'blur' | 'submit'
  className?: string
  onValidation?: (name: string, error: string | null) => void
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  children,
  rules = [],
  validateOn = 'blur',
  className,
  onValidation
}) => {
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  // 验证函数
  const validate = (value: any): string | null => {
    for (const rule of rules) {
      // 必填验证
      if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
        return rule.message || `${label || name}是必填项`
      }

      // 如果值为空且不是必填，跳过其他验证
      if (!value || (typeof value === 'string' && !value.trim())) {
        continue
      }

      // 最小长度验证
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        return rule.message || `${label || name}至少需要${rule.minLength}个字符`
      }

      // 最大长度验证
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        return rule.message || `${label || name}不能超过${rule.maxLength}个字符`
      }

      // 正则验证
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        return rule.message || `${label || name}格式不正确`
      }

      // 自定义验证
      if (rule.custom) {
        const customError = rule.custom(value)
        if (customError) {
          return customError
        }
      }
    }

    return null
  }

  // 处理验证
  const handleValidation = (value: any) => {
    const validationError = validate(value)
    setError(validationError)
    onValidation?.(name, validationError)
    return validationError
  }

  // 克隆子组件并添加验证逻辑
  const childWithValidation = React.cloneElement(children, {
    name,
    error: touched ? error : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      children.props.onChange?.(e)
      
      if (validateOn === 'change') {
        handleValidation(value)
      }
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true)
      children.props.onBlur?.(e)
      
      if (validateOn === 'blur' || validateOn === 'change') {
        handleValidation(e.target.value)
      }
    }
  })

  // 暴露验证方法给父组件
  useEffect(() => {
    // 将验证方法附加到组件实例
    const element = document.querySelector(`[name="${name}"]`) as any
    if (element) {
      element._validate = () => {
        const value = element.value
        return handleValidation(value)
      }
    }
  }, [name, rules])

  return (
    <div className={clsx('form-field', className)}>
      {childWithValidation}
    </div>
  )
}

export default FormField