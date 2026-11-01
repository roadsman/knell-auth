interface RateLimitConfig {
  baseLimit: number
  burstLimit: number
  window: number
  throttleThreshold: number
}

interface RequestLog {
  timestamp: number
  success: boolean
}

export class AdaptiveRateLimiter {
  private requests = new Map<string, RequestLog[]>()
  private config: RateLimitConfig
  private blockedUntil = new Map<string, number>()

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async check(key: string): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now()

    const blocked = this.blockedUntil.get(key)
    if (blocked && now < blocked) {
      return { allowed: false, remaining: 0 }
    }

    if (blocked && now >= blocked) {
      this.blockedUntil.delete(key)
    }

    let logs = this.requests.get(key) || []
    logs = logs.filter(log => now - log.timestamp < this.config.window)

    const recentFailures = logs.filter(log => !log.success).length
    const failureRate = logs.length > 0 ? recentFailures / logs.length : 0

    let currentLimit = this.config.baseLimit
    if (failureRate > this.config.throttleThreshold) {
      currentLimit = Math.floor(this.config.baseLimit * 0.5)
    } else if (failureRate < 0.1 && logs.length > this.config.baseLimit) {
      currentLimit = this.config.burstLimit
    }

    if (logs.length >= currentLimit) {
      this.blockedUntil.set(key, now + this.config.window)
      return { allowed: false, remaining: 0 }
    }

    logs.push({ timestamp: now, success: true })
    this.requests.set(key, logs)

    return {
      allowed: true,
      remaining: currentLimit - logs.length
    }
  }

  recordFailure(key: string): void {
    const now = Date.now()
    let logs = this.requests.get(key) || []
    logs = logs.filter(log => now - log.timestamp < this.config.window)
    logs.push({ timestamp: now, success: false })
    this.requests.set(key, logs)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, logs] of this.requests.entries()) {
      const recent = logs.filter(log => now - log.timestamp < this.config.window)
      if (recent.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, recent)
      }
    }

    for (const [key, until] of this.blockedUntil.entries()) {
      if (now >= until) {
        this.blockedUntil.delete(key)
      }
    }
  }
}

export const adaptiveRateLimiter = new AdaptiveRateLimiter({
  baseLimit: 100,
  burstLimit: 200,
  window: 60000,
  throttleThreshold: 0.3
})
