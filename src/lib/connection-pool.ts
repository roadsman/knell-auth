import { EventEmitter } from 'events'

interface PoolConfig {
  min: number
  max: number
  acquireTimeout: number
  idleTimeout: number
}

export class ConnectionPool<T> extends EventEmitter {
  private available: T[] = []
  private inUse = new Set<T>()
  private waiting: Array<{
    resolve: (conn: T) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = []
  private config: PoolConfig
  private factory: () => Promise<T>
  private destroyer: (conn: T) => Promise<void>
  private idleTimers = new Map<T, NodeJS.Timeout>()

  constructor(
    factory: () => Promise<T>,
    destroyer: (conn: T) => Promise<void>,
    config: PoolConfig
  ) {
    super()
    this.factory = factory
    this.destroyer = destroyer
    this.config = config
    this.warmup()
  }

  private async warmup(): Promise<void> {
    const promises = []
    for (let i = 0; i < this.config.min; i++) {
      promises.push(this.createConnection())
    }
    await Promise.all(promises)
  }

  private async createConnection(): Promise<T> {
    const conn = await this.factory()
    this.available.push(conn)
    return conn
  }

  async acquire(): Promise<T> {
    if (this.available.length > 0) {
      const conn = this.available.pop()!
      const timer = this.idleTimers.get(conn)
      if (timer) {
        clearTimeout(timer)
        this.idleTimers.delete(conn)
      }
      this.inUse.add(conn)
      return conn
    }

    const totalConnections = this.available.length + this.inUse.size
    if (totalConnections < this.config.max) {
      const conn = await this.createConnection()
      this.inUse.add(conn)
      return this.available.pop()!
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.findIndex(w => w.resolve === resolve)
        if (index !== -1) {
          this.waiting.splice(index, 1)
        }
        reject(new Error('Connection acquire timeout'))
      }, this.config.acquireTimeout)

      this.waiting.push({ resolve, reject, timeout })
    })
  }

  release(conn: T): void {
    if (!this.inUse.has(conn)) return

    this.inUse.delete(conn)

    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!
      clearTimeout(waiter.timeout)
      this.inUse.add(conn)
      waiter.resolve(conn)
      return
    }

    this.available.push(conn)

    const timer = setTimeout(async () => {
      const index = this.available.indexOf(conn)
      if (index !== -1 && this.available.length > this.config.min) {
        this.available.splice(index, 1)
        this.idleTimers.delete(conn)
        await this.destroyer(conn)
      }
    }, this.config.idleTimeout)

    this.idleTimers.set(conn, timer)
  }

  async drain(): Promise<void> {
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer)
    }

    const allConns = [...this.available, ...this.inUse]
    await Promise.all(allConns.map(conn => this.destroyer(conn)))

    this.available = []
    this.inUse.clear()
    this.idleTimers.clear()
  }

  stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      total: this.available.length + this.inUse.size
    }
  }
}
