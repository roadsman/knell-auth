import postgres from 'postgres'
import { config } from '../config.js'

export const sql = postgres(config.database.url, {
  max: config.database.pool.max,
  idle_timeout: config.database.pool.idleTimeout / 1000,
  connect_timeout: config.database.pool.connectionTimeout / 1000,
  prepare: true,
  transform: {
    undefined: null
  },
  types: {
    bigint: postgres.BigInt
  },
  onnotice: () => {},
  fetch_types: false,
  publications: 'alltables',
  max_lifetime: 60 * 30
})

export async function checkConnection() {
  try {
    await sql`select 1`
    return true
  } catch (error) {
    console.error('database connection failed:', error)
    return false
  }
}

export async function gracefulShutdown() {
  await sql.end({ timeout: 5 })
}
