import { sql } from '../data/db.js'
import { config } from '../config.js'
import crypto from 'crypto'

export async function recordLoginAttempt(email: string, ipAddress: string, success: boolean): Promise<void> {
  await sql`
    insert into login_attempts (email, ip_address, success)
    values (${email}, ${ipAddress}, ${success})
  `
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const [lock] = await sql`
    select * from account_locks
    where email = ${email} and locked_until > now()
  `
  return !!lock
}

export async function checkAndLockAccount(email: string, ipAddress: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - config.security.attemptWindow)
  
  const attempts = await sql`
    select count(*) as count from login_attempts
    where email = ${email}
    and success = false
    and created_at > ${cutoff}
  `

  const failedCount = parseInt(attempts[0].count)

  if (failedCount >= config.security.maxLoginAttempts) {
    const lockedUntil = new Date(Date.now() + config.security.lockoutDuration)
    
    await sql`
      insert into account_locks (email, locked_until, reason)
      values (${email}, ${lockedUntil}, 'too many failed login attempts')
      on conflict (email) 
      do update set locked_until = ${lockedUntil}
    `

    return true
  }

  return false
}

export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  const [block] = await sql`
    select * from ip_blocklist
    where ip_address = ${ipAddress}
    and (blocked_until is null or blocked_until > now())
  `
  return !!block
}

export async function blockIp(ipAddress: string, reason: string, duration?: number): Promise<void> {
  const blockedUntil = duration ? new Date(Date.now() + duration) : null
  
  await sql`
    insert into ip_blocklist (ip_address, reason, blocked_until)
    values (${ipAddress}, ${reason}, ${blockedUntil})
    on conflict (ip_address)
    do update set blocked_until = ${blockedUntil}, reason = ${reason}
  `
}

export async function logAuditEvent(
  userId: string | null,
  action: string,
  ipAddress: string | null,
  userAgent: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  await sql`
    insert into audit_logs (user_id, action, ip_address, user_agent, metadata)
    values (${userId}, ${action}, ${ipAddress}, ${userAgent}, ${metadata ? JSON.stringify(metadata) : null})
  `
}

export function generateDeviceFingerprint(ipAddress: string, userAgent: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ipAddress}:${userAgent}`)
    .digest('hex')
}

export async function cleanupOldAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await sql`delete from login_attempts where created_at < ${cutoff}`
}

export async function cleanupExpiredLocks(): Promise<void> {
  await sql`delete from account_locks where locked_until < now()`
}
