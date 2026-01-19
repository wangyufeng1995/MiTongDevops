/**
 * 本地存储工具类
 */
export class StorageUtils {
  /**
   * 设置 localStorage 项目
   */
  static setItem(key: string, value: any): void {
    try {
      const serializedValue = JSON.stringify(value)
      localStorage.setItem(key, serializedValue)
    } catch (error) {
      console.error('Error setting localStorage item:', error)
    }
  }

  /**
   * 获取 localStorage 项目
   */
  static getItem<T = any>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key)
      if (item === null) {
        return defaultValue || null
      }
      return JSON.parse(item)
    } catch (error) {
      console.error('Error getting localStorage item:', error)
      return defaultValue || null
    }
  }

  /**
   * 移除 localStorage 项目
   */
  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error removing localStorage item:', error)
    }
  }

  /**
   * 清空 localStorage
   */
  static clear(): void {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }

  /**
   * 设置 sessionStorage 项目
   */
  static setSessionItem(key: string, value: any): void {
    try {
      const serializedValue = JSON.stringify(value)
      sessionStorage.setItem(key, serializedValue)
    } catch (error) {
      console.error('Error setting sessionStorage item:', error)
    }
  }

  /**
   * 获取 sessionStorage 项目
   */
  static getSessionItem<T = any>(key: string, defaultValue?: T): T | null {
    try {
      const item = sessionStorage.getItem(key)
      if (item === null) {
        return defaultValue || null
      }
      return JSON.parse(item)
    } catch (error) {
      console.error('Error getting sessionStorage item:', error)
      return defaultValue || null
    }
  }

  /**
   * 移除 sessionStorage 项目
   */
  static removeSessionItem(key: string): void {
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      console.error('Error removing sessionStorage item:', error)
    }
  }

  /**
   * 清空 sessionStorage
   */
  static clearSession(): void {
    try {
      sessionStorage.clear()
    } catch (error) {
      console.error('Error clearing sessionStorage:', error)
    }
  }

  /**
   * 检查是否支持 localStorage
   */
  static isLocalStorageSupported(): boolean {
    try {
      const testKey = '__localStorage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * 检查是否支持 sessionStorage
   */
  static isSessionStorageSupported(): boolean {
    try {
      const testKey = '__sessionStorage_test__'
      sessionStorage.setItem(testKey, 'test')
      sessionStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取存储大小（字节）
   */
  static getStorageSize(): { localStorage: number; sessionStorage: number } {
    let localStorageSize = 0
    let sessionStorageSize = 0

    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += localStorage[key].length + key.length
        }
      }
    } catch (error) {
      console.error('Error calculating localStorage size:', error)
    }

    try {
      for (const key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
          sessionStorageSize += sessionStorage[key].length + key.length
        }
      }
    } catch (error) {
      console.error('Error calculating sessionStorage size:', error)
    }

    return { localStorage: localStorageSize, sessionStorage: sessionStorageSize }
  }
}