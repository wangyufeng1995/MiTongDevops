/**
 * ModalStack - Modal栈管理器
 * 管理Modal栈和Promise，支持嵌套Modal
 */

export interface ModalStackItem<T = any> {
  id: string
  resolve: (value: T) => void
  reject: (reason?: any) => void
  data?: any
}

class ModalStackManager {
  private stack: ModalStackItem[] = []

  /**
   * 添加Modal到栈
   */
  push<T = any>(item: ModalStackItem<T>): void {
    this.stack.push(item)
  }

  /**
   * 从栈中移除Modal
   */
  pop(): ModalStackItem | undefined {
    return this.stack.pop()
  }

  /**
   * 根据ID移除Modal
   */
  remove(id: string): ModalStackItem | undefined {
    const index = this.stack.findIndex(item => item.id === id)
    if (index !== -1) {
      const [item] = this.stack.splice(index, 1)
      return item
    }
    return undefined
  }

  /**
   * 根据ID查找Modal
   */
  find(id: string): ModalStackItem | undefined {
    return this.stack.find(item => item.id === id)
  }

  /**
   * 获取栈顶Modal
   */
  peek(): ModalStackItem | undefined {
    return this.stack[this.stack.length - 1]
  }

  /**
   * 获取栈大小
   */
  size(): number {
    return this.stack.length
  }

  /**
   * 清空栈
   */
  clear(): void {
    // Reject all pending modals
    this.stack.forEach(item => {
      item.reject(new Error('Modal stack cleared'))
    })
    this.stack = []
  }

  /**
   * 获取所有Modal
   */
  getAll(): ModalStackItem[] {
    return [...this.stack]
  }

  /**
   * 检查栈是否为空
   */
  isEmpty(): boolean {
    return this.stack.length === 0
  }
}

// Export singleton instance
export const modalStack = new ModalStackManager()

export default modalStack
