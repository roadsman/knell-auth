import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import { queries } from '../data/queries.js'
import { errors } from '../lib/errors.js'
import { generateSecureToken } from '../lib/crypto.js'
import { logAuditEvent } from '../lib/security.js'

export async function enableTOTP(userId: string, email: string) {
  const secret = new Secret()
  
  const totp = new TOTP({
    issuer: 'Knell',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret
  })

  const backupCodes = Array.from({ length: 10 }, () => 
    generateSecureToken().substring(0, 8).toUpperCase()
  )

  await queries.createTOTPSecret(userId, secret.base32, backupCodes)

  const qrCodeUrl = await QRCode.toDataURL(totp.toString())

  return {
    secret: secret.base32,
    qrCode: qrCodeUrl,
    backupCodes
  }
}

export async function verifyTOTP(userId: string, code: string) {
  const totpData = await queries.findTOTPSecret(userId)
  
  if (!totpData) {
    throw errors.invalidToken()
  }

  const secret = Secret.fromBase32(totpData.secret)
  const totp = new TOTP({
    secret: secret,
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  })

  const delta = totp.validate({ token: code, window: 1 })

  if (delta === null) {
    const backupCodes = totpData.backup_codes as string[]
    if (backupCodes && backupCodes.includes(code)) {
      const remainingCodes = backupCodes.filter(c => c !== code)
      await queries.updateTOTPBackupCodes(userId, remainingCodes)
      return { valid: true, method: 'backup_code' }
    }
    
    return { valid: false }
  }

  return { valid: true, method: 'totp' }
}

export async function confirmTOTP(userId: string, code: string) {
  const result = await verifyTOTP(userId, code)
  
  if (!result.valid) {
    throw new Error('Invalid verification code')
  }

  await queries.enableTOTP(userId)
  await logAuditEvent(userId, 'totp.enabled', null, null)

  return { success: true }
}

export async function disableTOTP(userId: string, code: string) {
  const result = await verifyTOTP(userId, code)
  
  if (!result.valid) {
    throw new Error('Invalid verification code')
  }

  await queries.deleteTOTPSecret(userId)
  await logAuditEvent(userId, 'totp.disabled', null, null)

  return { success: true }
}
