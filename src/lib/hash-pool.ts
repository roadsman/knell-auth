import { Worker } from 'worker_threads'
import { cpus } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class HashWorkerPool {
  private workers: Worker[] = []
  private queue: Array<{
    password: string
    resolve: (hash: string) => void
    reject: (error: Error) => void
  }> = []
  private nextWorkerId = 0
  private taskId = 0

  constructor(size: number = Math.max(2, cpus().length - 1)) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(join(__dirname, 'worker.js'))
      
      worker.on('message', (data: { hash: string; id: number }) => {
        const task = this.queue.shift()
        if (task) {
          task.resolve(data.hash)
        }
      })

      worker.on('error', (error) => {
        const task = this.queue.shift()
        if (task) {
          task.reject(error)
        }
      })

      this.workers.push(worker)
    }
  }

  async hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ password, resolve, reject })
      
      const worker = this.workers[this.nextWorkerId]
      this.nextWorkerId = (this.nextWorkerId + 1) % this.workers.length
      
      worker.postMessage({ password, id: this.taskId++ })
    })
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map(w => w.terminate()))
  }
}

export const hashPool = new HashWorkerPool()
