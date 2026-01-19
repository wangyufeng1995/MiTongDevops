import JSEncrypt from 'jsencrypt'
import { authService } from './auth'
import { StorageUtils } from '../utils/storage'

interface EncryptionConfig {
  keySize: number
  algorithm: string
  cacheTTL: number
}

class PasswordEncryptService {
  private publicKey: string = ''
  private encrypt: JSEncrypt | null = null
  private readonly config: EncryptionConfig = {
    keySize: 2048,
    algorithm: 'RSA-OAEP',
    cacheTTL: 0 // 不缓存，每次都从后端获取
  }

  /**
   * 初始化加密服务（每次都从后端获取最新公钥）
   */
  async initializeEncryption(): Promise<void> {
    try {
      // 每次都从后端获取最新公钥（后端重启会生成新密钥）
      const response = await authService.getPublicKey()
      this.publicKey = response.publicKey
      
      this.setupEncryption()
    } catch (error) {
      console.error('Failed to initialize password encryption:', error)
      throw new Error('密码加密初始化失败')
    }
  }

  /**
   * 设置加密实例
   */
  private setupEncryption(): void {
    this.encrypt = new JSEncrypt()
    this.encrypt.setPublicKey(this.publicKey)
  }

  /**
   * 加密密码
   */
  encryptPassword(password: string): string {
    if (!this.encrypt) {
      throw new Error('密码加密未初始化，请先调用 initializeEncryption()')
    }
    
    if (!password || password.trim().length === 0) {
      throw new Error('密码不能为空')
    }
    
    const encrypted = this.encrypt.encrypt(password)
    if (!encrypted) {
      throw new Error('密码加密失败，请检查公钥是否有效')
    }
    
    return encrypted
  }

  /**
   * 异步加密密码（自动初始化）
   */
  async encryptPasswordAsync(password: string): Promise<string> {
    // 每次加密前都重新获取公钥，确保与后端一致
    await this.initializeEncryption()
    return this.encryptPassword(password)
  }

  /**
   * 验证密码强度
   */
  validatePasswordStrength(password: string): {
    isValid: boolean
    score: number
    feedback: string[]
  } {
    const feedback: string[] = []
    let score = 0

    if (password.length < 8) {
      feedback.push('密码长度至少需要8位')
    } else {
      score += 1
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('密码需要包含小写字母')
    } else {
      score += 1
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('密码需要包含大写字母')
    } else {
      score += 1
    }

    if (!/\d/.test(password)) {
      feedback.push('密码需要包含数字')
    } else {
      score += 1
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push('密码需要包含特殊字符')
    } else {
      score += 1
    }

    return {
      isValid: score >= 3,
      score,
      feedback
    }
  }

  /**
   * 生成安全密码
   */
  generateSecurePassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*(),.?":{}|<>'
    
    const allChars = lowercase + uppercase + numbers + symbols
    let password = ''
    
    // 确保至少包含每种类型的字符
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    
    // 填充剩余长度
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // 打乱字符顺序
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  /**
   * 清除缓存的公钥（保留方法以兼容旧代码）
   */
  clearCache(): void {
    StorageUtils.removeSessionItem('rsa_public_key')
    this.publicKey = ''
    this.encrypt = null
  }

  /**
   * 检查加密服务是否已初始化
   */
  isInitialized(): boolean {
    return !!this.encrypt && !!this.publicKey
  }

  /**
   * 获取加密配置信息
   */
  getConfig(): EncryptionConfig {
    return { ...this.config }
  }
}

export const passwordEncryptService = new PasswordEncryptService()