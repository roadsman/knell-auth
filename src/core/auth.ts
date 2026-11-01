import { queries } from '../data/queries.js'
import { hashPassword, verifyPassword } from '../lib/crypto.js'
import { errors } from '../lib/errors.js'
import { validatePasswordStrength } from '../lib/password.js'
import { createSession, SessionContext } from './sessions.js'
import { createAccessToken } from './tokens.js'
import { 
  recordLoginAttempt, 
  isAccountLocked, 
  checkAndLockAccount,
  isIpBlocked,
  logAuditEvent
} from '../lib/security.js'

export async function signup(email: string, password: string, context: SessionContext = {}) {
  const existing = await queries.findUserByEmail(email)
  if (existing) {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))
    throw errors.emailTaken()
  }

  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    throw new Error(strength.feedback.join('. '))
  }

  const passwordHash = await hashPassword(password)
  
  const [user, _] = await Promise.all([
    queries.createUser(email, passwordHash),
    logAuditEvent(null, 'user.signup.attempt', context.ipAddress || null, context.userAgent || null, { email })
  ])

  await logAuditEvent(user.id, 'user.signup', context.ipAddress || null, context.userAgent || null)

  const session = await createSession(user.id, context)
  const accessToken = createAccessToken(user.id, user.email)

  return {
    user: {
      id: user.id,
      email: user.email,
      verified: user.verified
    },
    accessToken,
    refreshToken: session.token
  }
}

export async function login(email: string, password: string, context: SessionContext = {}) {
  if (context.ipAddress && await isIpBlocked(context.ipAddress)) {
    await logAuditEvent(null, 'login.blocked_ip', context.ipAddress, context.userAgent || null)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200))
    throw errors.unauthorized()
  }

  if (await isAccountLocked(email)) {
    await logAuditEvent(null, 'login.account_locked', context.ipAddress || null, context.userAgent || null, { email })
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200))
    throw errors.accountLocked()
  }

  const user = await queries.findUserByEmail(email)
  
  const isValid = user && await verifyPassword(password, user.password_hash)
  
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

  if (!isValid) {
    if (context.ipAddress) {
      await recordLoginAttempt(email, context.ipAddress, false)
      await checkAndLockAccount(email, context.ipAddress)
    }
    await logAuditEvent(null, 'login.failed', context.ipAddress || null, context.userAgent || null, { email })
    throw errors.invalidCredentials()
  }

  if (context.ipAddress) {
    await recordLoginAttempt(email, context.ipAddress, true)
  }

  await logAuditEvent(user!.id, 'login.success', context.ipAddress || null, context.userAgent || null)

  const session = await createSession(user!.id, context)
  const accessToken = createAccessToken(user!.id, user!.email)

  return {
    user: {
      id: user!.id,
      email: user!.email,
      verified: user!.verified
    },
    accessToken,
    refreshToken: session.token
  }
}

export async function logout(sessionToken: string, userId: string, context: SessionContext = {}) {
  await queries.deleteSession(sessionToken)
  await logAuditEvent(userId, 'logout', context.ipAddress || null, context.userAgent || null)
}

export async function refreshAccess(refreshToken: string) {
  const session = await queries.findSessionByToken(refreshToken)
  if (!session) {
    throw errors.invalidToken()
  }

  const user = await queries.findUserById(session.user_id)
  if (!user) {
    throw errors.userNotFound()
  }

  await queries.updateSessionActivity(session.id)

  return createAccessToken(user.id, user.email)
}
