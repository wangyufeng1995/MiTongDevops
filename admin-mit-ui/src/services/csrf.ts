import { authService } from './auth'

class CSRFService {
  private token: string = ''

  async getToken(): Promise<string> {
    if (!this.token) {
      await this.refreshToken()
    }
    return this.token
  }

  async refreshToken(): Promise<string> {
    try {
      const response = await authService.getCSRFToken()
      this.token = response.csrf_token
      return this.token
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error)
      throw error
    }
  }

  clearToken(): void {
    this.token = ''
  }

  hasToken(): boolean {
    return !!this.token
  }
}

export const csrfService = new CSRFService()