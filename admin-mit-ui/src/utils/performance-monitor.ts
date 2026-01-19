/**
 * 性能监控工具
 * 用于监控模块加载和重复请求问题
 */

interface PerformanceMetrics {
  moduleLoads: Map<string, number>
  apiCalls: Map<string, number>
  renderCount: number
  startTime: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    moduleLoads: new Map(),
    apiCalls: new Map(),
    renderCount: 0,
    startTime: Date.now()
  }

  private isEnabled = process.env.NODE_ENV === 'development'

  trackModuleLoad(moduleName: string) {
    if (!this.isEnabled) return

    const count = this.metrics.moduleLoads.get(moduleName) || 0
    this.metrics.moduleLoads.set(moduleName, count + 1)
  }

  trackApiCall(url: string, isDuplicate: boolean = false) {
    if (!this.isEnabled) return

    const count = this.metrics.apiCalls.get(url) || 0
    this.metrics.apiCalls.set(url, count + 1)
  }

  trackRender(componentName: string) {
    if (!this.isEnabled) return

    this.metrics.renderCount++
  }

  getReport() {
    if (!this.isEnabled) return null

    const duplicateModules = Array.from(this.metrics.moduleLoads.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])

    const duplicateApiCalls = Array.from(this.metrics.apiCalls.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])

    return {
      totalTime: Date.now() - this.metrics.startTime,
      totalRenders: this.metrics.renderCount,
      duplicateModules,
      duplicateApiCalls,
      totalModuleLoads: this.metrics.moduleLoads.size,
      totalApiCalls: this.metrics.apiCalls.size
    }
  }

  printReport() {
    // 禁用控制台输出
    return
  }

  reset() {
    this.metrics = {
      moduleLoads: new Map(),
      apiCalls: new Map(),
      renderCount: 0,
      startTime: Date.now()
    }
  }
}

export const performanceMonitor = new PerformanceMonitor()

// 在开发环境中自动打印报告
if (process.env.NODE_ENV === 'development') {
  // 页面加载完成后打印报告
  window.addEventListener('load', () => {
    setTimeout(() => {
      performanceMonitor.printReport()
    }, 2000)
  })

  // 暴露到全局以便调试
  ;(window as any).performanceMonitor = performanceMonitor
}