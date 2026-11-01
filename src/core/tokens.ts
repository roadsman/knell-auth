import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { generateSecureToken } from '../lib/crypto.js'

export interface TokenPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
  iss?: string
  aud?: string
}

const ISSUER = 'knell-auth'
const AUDIENCE = 'knell-api'

export function createAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { 
      userId, 
      email,
      iss: ISSUER,
      aud: AUDIENCE
    } as TokenPayload,
    config.jwt.secret,
    { 
      expiresIn: config.jwt.expiresIn,
      algorithm: 'HS256',
      notBefore: '0s'
    }
  )
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: 10
    }) as TokenPayload

    if (!decoded.userId || !decoded.email) {
      return null
    }

    return decoded
  } catch (error) {
    return null
  }
}

export function createRefreshToken(): string {
  return generateSecureToken()
}
