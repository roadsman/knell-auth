interface Metric {
  count: number
  sum: number
  min: number
  max: number
  avg: number
}

class MetricsCollector {
  private metrics: Map<string, number[]> = new Map()
  private counters: Map<string, number> = new Map()

  recordTiming(name: string, durationMs: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(durationMs)
  }

  increment(name: string, value: number = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + value)
  }

  getMetric(name: string): Metric | null {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) return null

    const sum = values.reduce((a, b) => a + b, 0)
    return {
      count: values.length,
      sum,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length
    }
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0
  }

  getAll(): Record<string, any> {
    const result: Record<string, any> = {}
    
    for (const [name, _] of this.metrics) {
      result[name] = this.getMetric(name)
    }
    
    for (const [name, value] of this.counters) {
      result[`counter.${name}`] = value
    }
    
    return result
  }

  reset(): void {
    this.metrics.clear()
    this.counters.clear()
  }
}

export const metrics = new MetricsCollector()

export function measureTime<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  return fn().finally(() => {
    metrics.recordTiming(name, Date.now() - start)
  })
}
