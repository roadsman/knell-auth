import { queries } from '../data/queries.js'
import { createSession, SessionContext } from './sessions.js'
import { createAccessToken } from './tokens.js'
import { logAuditEvent } from '../lib/security.js'
import { config } from '../config.js'

interface OAuthUserInfo {
  provider: string
  providerId: string
  email: string
  name?: string
}

export async function handleOAuthCallback(userInfo: OAuthUserInfo, context: SessionContext = {}) {
  let user = await queries.findUserByEmail(userInfo.email)

  if (!user) {
    const { hashPassword } = await import('../lib/crypto.js')
    const randomPassword = await hashPassword(Math.random().toString(36))
    
    user = await queries.createUser(userInfo.email, randomPassword)
    await queries.markUserVerified(user.id)
    
    await logAuditEvent(user.id, 'user.oauth_signup', context.ipAddress || null, context.userAgent || null, {
      provider: userInfo.provider
    })
  }

  await queries.upsertOAuthProvider(user.id, userInfo.provider, userInfo.providerId)

  await logAuditEvent(user.id, 'login.oauth', context.ipAddress || null, context.userAgent || null, {
    provider: userInfo.provider
  })

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

export function getGoogleOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
    response_type: 'code',
    scope: 'openid email profile',
    state
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function getGitHubOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback',
    scope: 'read:user user:email',
    state
  })

  return `https://github.com/login/oauth/authorize?${params}`
}

export async function exchangeGoogleCode(code: string): Promise<OAuthUserInfo> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
      grant_type: 'authorization_code'
    })
  })

  const tokens = await tokenResponse.json()

  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  })

  const userData = await userResponse.json()

  return {
    provider: 'google',
    providerId: userData.id,
    email: userData.email,
    name: userData.name
  }
}

export async function exchangeGitHubCode(code: string): Promise<OAuthUserInfo> {
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      client_secret: process.env.GITHUB_CLIENT_SECRET || '',
      code
    })
  })

  const tokens = await tokenResponse.json()

  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  })

  const userData = await userResponse.json()

  const emailResponse = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  })

  const emails = await emailResponse.json()
  const primaryEmail = emails.find((e: any) => e.primary)?.email || userData.email

  return {
    provider: 'github',
    providerId: userData.id.toString(),
    email: primaryEmail,
    name: userData.name
  }
}
