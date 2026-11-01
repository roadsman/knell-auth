import 'dotenv/config'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'
import { config } from '../src/config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigrations() {
  const sql = postgres(config.database.url)

  try {
    console.log('Running migrations...')

    const schemaSQL = readFileSync(join(__dirname, '../sql/schema.sql'), 'utf-8')
    await sql.unsafe(schemaSQL)
    console.log('[schema] migration complete')

    const securitySQL = readFileSync(join(__dirname, '../sql/security.sql'), 'utf-8')
    await sql.unsafe(securitySQL)
    console.log('[security] migration complete')

    console.log('migrations completed')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

runMigrations()
