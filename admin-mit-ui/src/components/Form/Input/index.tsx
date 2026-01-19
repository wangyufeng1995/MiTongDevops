import React, { forwardRef, useState } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { useTheme } from '../../../hooks/useTheme'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'outlined' | 'filled'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  showPasswordToggle?: boolean
  required?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  size = 'md',
  variant = 'outlined',
  leftIcon,
  rightIcon,
  showPasswordToggle = false,
  required = false,
  className,
  type = 'text',
  disabled,
  ...props
}, ref) => {
  const { isDark } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState(false)

  const inputType = showPasswordToggle && type === 'password' 
    ? (showPassword ? 'text' : 'password')
    : type

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const variantClasses = {
    outlined: isDark ? 'border border-gray-600 bg-gray-700/50' : 'border border-gray-300 bg-white',
    filled: isDark ? 'border-0 bg-gray-700' : 'border-0 bg-gray-100'
  }

  const inputClasses = clsx(
    'w-full rounded-md transition-colors duration-200',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    isDark ? 'text-gray-200 placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400',
    isDark ? 'disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed' : 'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
    sizeClasses[size],
    variantClasses[variant],
    {
      'border-red-300 focus:border-red-500 focus:ring-red-500': error,
      'pl-10': leftIcon,
      'pr-10': rightIcon || showPasswordToggle,
    },
    className
  )

  const labelClasses = clsx(
    'block text-sm font-medium mb-1',
    {
      [isDark ? 'text-gray-300' : 'text-gray-700']: !error,
      'text-red-500': error,
    }
  )

  return (
    <div className="w-full">
      {label && (
        <label className={labelClasses}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>
              {leftIcon}
            </div>
          </div>
        )}
        
        <input
          ref={ref}
          type={inputType}
          className={inputClasses}
          disabled={disabled}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />
        
        {(rightIcon || showPasswordToggle) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {showPasswordToggle && type === 'password' ? (
              <button
                type="button"
                className={`focus:outline-none ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                onClick={() => setShowPassword(!showPassword)}
                disabled={disabled}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            ) : rightIcon ? (
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                {rightIcon}
              </div>
            ) : null}
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <div className="mt-1 flex items-center">
          {error && (
            <>
              <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
              <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
            </>
          )}
          {!error && helperText && (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{helperText}</p>
          )}
        </div>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input