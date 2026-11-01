import { queries } from '../data/queries.js'
import { generateSecureToken } from '../lib/crypto.js'
import { config } from '../config.js'
import { errors } from '../lib/errors.js'
import { logAuditEvent } from '../lib/security.js'

export async function createEmailVerification(userId: string) {
  const token = generateSecureToken()
  const expiresAt = new Date(Date.now() + config.verification.tokenDuration)
  
  await queries.createVerificationToken(userId, token, 'email_verification', expiresAt)
  
  return token
}

export async function verifyEmail(token: string, ipAddress?: string, userAgent?: string) {
  const vToken = await queries.findVerificationToken(token, 'email_verification')
  
  if (!vToken) {
    throw errors.invalidToken()
  }

  await queries.markUserVerified(vToken.user_id)
  await queries.deleteVerificationToken(token)
  
  await logAuditEvent(vToken.user_id, 'email.verified', ipAddress || null, userAgent || null)

  return { success: true }
}

export async function createPasswordReset(email: string) {
  const user = await queries.findUserByEmail(email)
  
  if (!user) {
    return { success: true }
  }

  const token = generateSecureToken()
  const expiresAt = new Date(Date.now() + config.verification.tokenDuration)
  
  await queries.createVerificationToken(user.id, token, 'password_reset', expiresAt)
  
  await logAuditEvent(user.id, 'password_reset.requested', null, null)

  return { token, email: user.email }
}

export async function resetPassword(token: string, newPassword: string, ipAddress?: string, userAgent?: string) {
  const vToken = await queries.findVerificationToken(token, 'password_reset')
  
  if (!vToken) {
    throw errors.invalidToken()
  }

  const { hashPassword } = await import('../lib/crypto.js')
  const { validatePasswordStrength } = await import('../lib/password.js')

  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) {
    throw new Error(strength.feedback.join('. '))
  }

  const passwordHash = await hashPassword(newPassword)
  
  await queries.updateUserPassword(vToken.user_id, passwordHash)
  await queries.deleteVerificationToken(token)
  await queries.deleteUserSessions(vToken.user_id)
  
  await logAuditEvent(vToken.user_id, 'password.reset', ipAddress || null, userAgent || null)

  return { success: true }
}
