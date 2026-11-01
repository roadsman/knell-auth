enum State {
  CLOSED,
  OPEN,
  HALF_OPEN
}

interface CircuitBreakerOptions {
  failureThreshold: number
  successThreshold: number
  timeout: number
  resetTimeout: number
}

export class CircuitBreaker {
  private state: State = State.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private nextAttempt: number = Date.now()
  private options: CircuitBreakerOptions

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 60000,
      resetTimeout: options.resetTimeout || 10000
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === State.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN')
      }
      this.state = State.HALF_OPEN
    }

    try {
      const result = await Promise.race([
        fn(),
        this.timeout()
      ])

      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0

    if (this.state === State.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.options.successThreshold) {
        this.state = State.CLOSED
        this.successCount = 0
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.successCount = 0

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = State.OPEN
      this.nextAttempt = Date.now() + this.options.resetTimeout
    }
  }

  private timeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), this.options.timeout)
    })
  }

  getState(): string {
    return State[this.state]
  }

  reset(): void {
    this.state = State.CLOSED
    this.failureCount = 0
    this.successCount = 0
  }
}
