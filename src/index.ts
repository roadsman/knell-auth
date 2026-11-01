import 'dotenv/config'
import { startServer } from './http/server.js'
import { checkConnection, gracefulShutdown } from './data/db.js'
import { runCleanup } from './lib/cleanup.js'
import { cache } from './lib/cache.js'

async function main() {
  const dbConnected = await checkConnection()
  
  if (!dbConnected) {
    console.error('Failed to connect to database')
    process.exit(1)
  }

  console.log('Database connected')

  const cleanupInterval = setInterval(async () => {
    try {
      await runCleanup()
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }, 60 * 60 * 1000)

  const server = await startServer()

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`)
    
    clearInterval(cleanupInterval)
    cache.destroy()
    
    await server.close()
    await gracefulShutdown()
    
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main()
