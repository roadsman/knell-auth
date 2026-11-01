interface CacheEntry<T> {
  value: T
  expiresAt: number
  size: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupInterval: NodeJS.Timeout
  private maxMemory: number
  private currentMemory: number = 0

  constructor(
    cleanupIntervalMs: number = 60000,
    maxMemoryMB: number = 100
  ) {
    this.maxMemory = maxMemoryMB * 1024 * 1024
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs)
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const size = this.estimateSize(value)

    while (this.currentMemory + size > this.maxMemory && this.cache.size > 0) {
      this.evictOldest()
    }

    const existing = this.cache.get(key)
    if (existing) {
      this.currentMemory -= existing.size
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      size
    })

    this.currentMemory += size
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return null
    }
    
    return entry.value as T
  }

  delete(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      this.currentMemory -= entry.size
      this.cache.delete(key)
    }
  }

  clear(): void {
    this.cache.clear()
    this.currentMemory = 0
  }

  private estimateSize(value: any): number {
    const str = JSON.stringify(value)
    return str.length * 2
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key)
      }
    }
  }

  stats() {
    return {
      size: this.cache.size,
      memoryUsed: this.currentMemory,
      memoryMax: this.maxMemory,
      memoryPercent: (this.currentMemory / this.maxMemory) * 100
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.cache.clear()
  }
}

export const cache = new MemoryCache(60000, 100)
