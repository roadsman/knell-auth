type BatchTask<T> = {
  resolve: (value: T) => void
  reject: (error: any) => void
  key: string
}

export class BatchProcessor<T> {
  private queue: Map<string, BatchTask<T>[]> = new Map()
  private timer: NodeJS.Timeout | null = null
  private readonly batchSize: number
  private readonly batchDelay: number
  private readonly processor: (keys: string[]) => Promise<Map<string, T>>

  constructor(
    processor: (keys: string[]) => Promise<Map<string, T>>,
    batchSize: number = 100,
    batchDelay: number = 10
  ) {
    this.processor = processor
    this.batchSize = batchSize
    this.batchDelay = batchDelay
  }

  async fetch(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.queue.has(key)) {
        this.queue.set(key, [])
      }
      this.queue.get(key)!.push({ resolve, reject, key })

      if (this.queue.size >= this.batchSize) {
        this.flush()
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchDelay)
      }
    })
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    const currentQueue = new Map(this.queue)
    this.queue.clear()

    const keys = Array.from(currentQueue.keys())
    if (keys.length === 0) return

    try {
      const results = await this.processor(keys)

      for (const [key, tasks] of currentQueue) {
        const result = results.get(key)
        for (const task of tasks) {
          if (result !== undefined) {
            task.resolve(result)
          } else {
            task.reject(new Error(`No result for key: ${key}`))
          }
        }
      }
    } catch (error) {
      for (const tasks of currentQueue.values()) {
        for (const task of tasks) {
          task.reject(error)
        }
      }
    }
  }
}
