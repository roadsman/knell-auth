import { queries } from '../data/queries.js'
import { config } from '../config.js'
import { createRefreshToken } from './tokens.js'
import { generateDeviceFingerprint, logAuditEvent } from '../lib/security.js'
import { errors } from '../lib/errors.js'
import { cache } from '../lib/cache.js'

export interface SessionContext {
  ipAddress?: string
  userAgent?: string
}

export async function createSession(userId: string, context: SessionContext = {}) {
  const activeSessions = await queries.findUserSessions(userId)
  
  if (activeSessions.length >= config.session.maxConcurrent) {
    const oldestSession = activeSessions[activeSessions.length - 1]
    await queries.deleteSession(oldestSession.token)
    cache.delete(`session:${oldestSession.token}`)
    
    await logAuditEvent(userId, 'session.evicted', context.ipAddress || null, context.userAgent || null, {
      evictedSessionId: oldestSession.id
    })
  }

  const token = createRefreshToken()
  const expiresAt = new Date(Date.now() + config.session.duration)
  
  const deviceFingerprint = context.ipAddress && context.userAgent
    ? generateDeviceFingerprint(context.ipAddress, context.userAgent)
    : undefined

  const session = await queries.createSession(
    userId,
    token,
    expiresAt,
    context.ipAddress,
    context.userAgent,
    deviceFingerprint
  )

  cache.set(`session:${token}`, session, config.session.duration)
  
  return session
}

export async function validateSession(token: string) {
  const cached = cache.get(`session:${token}`)
  if (cached) {
    await queries.updateSessionActivity(cached.id)
    return cached
  }

  const session = await queries.findSessionByToken(token)
  if (!session) {
    throw errors.invalidToken()
  }

  cache.set(`session:${token}`, session, config.session.duration)
  await queries.updateSessionActivity(session.id)
  
  return session
}

export async function revokeSession(token: string) {
  cache.delete(`session:${token}`)
  await queries.deleteSession(token)
}

export async function revokeAllUserSessions(userId: string) {
  const sessions = await queries.findUserSessions(userId)
  for (const session of sessions) {
    cache.delete(`session:${session.token}`)
  }
  await queries.deleteUserSessions(userId)
}

export async function getUserActiveSessions(userId: string) {
  return queries.findUserSessions(userId)
}
