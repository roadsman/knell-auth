import { sql } from '../data/db.js'

export async function cleanupExpiredSessions() {
  await sql`delete from sessions where expires_at < now()`
}

export async function cleanupExpiredVerificationTokens() {
  await sql`delete from verification_tokens where expires_at < now()`
}

export async function cleanupOldLoginAttempts() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await sql`delete from login_attempts where created_at < ${cutoff}`
}

export async function cleanupExpiredAccountLocks() {
  await sql`delete from account_locks where locked_until < now()`
}

export async function cleanupOldAuditLogs() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  await sql`delete from audit_logs where created_at < ${cutoff}`
}

export async function runCleanup() {
  await Promise.all([
    cleanupExpiredSessions(),
    cleanupExpiredVerificationTokens(),
    cleanupOldLoginAttempts(),
    cleanupExpiredAccountLocks(),
    cleanupOldAuditLogs()
  ])
}
