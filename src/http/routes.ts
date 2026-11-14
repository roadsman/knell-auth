import { FastifyInstance } from 'fastify'
import { signup, login, logout, refreshAccess } from '../core/auth.js'
import { revokeAllUserSessions, getUserActiveSessions } from '../core/sessions.js'
import { verifyEmail, createPasswordReset, resetPassword } from '../core/verification.js'
import { enableTOTP, verifyTOTP, confirmTOTP, disableTOTP } from '../core/totp.js'
import { handleOAuthCallback, getGoogleOAuthUrl, getGitHubOAuthUrl, exchangeGoogleCode, exchangeGitHubCode } from '../core/oauth.js'
import { generateRegistration, verifyRegistration, generateAuthentication, verifyAuthentication } from '../core/webauthn.js'
import { queries } from '../data/queries.js'
import { authenticate, getClientIp, getUserAgent } from './middleware.js'
import { 
  signupSchema, 
  loginSchema, 
  refreshSchema,
  verifyTokenSchema,
  passwordResetRequestSchema,
  passwordResetSchema
} from './validation.js'
import { AuthError } from '../lib/errors.js'
import { metrics, measureTime } from '../lib/metrics.js'
import { cache } from '../lib/cache.js'
import { sendPasswordResetEmail } from '../lib/email.js'
import { generateSecureToken } from '../lib/crypto.js'

export async function registerRoutes(app: FastifyInstance) {
  const authLimiter = {
    config: {
      max: 5,
      timeWindow: '15 minutes'
    }
  }

  app.post('/signup', { config: authLimiter.config }, async (request, reply) => {
    const body = signupSchema.parse(request.body)
    
    const result = await measureTime('signup', () => 
      signup(body.email, body.password, {
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request)
      })
    )

    metrics.increment('auth.signup')
    return reply.code(201).send(result)
  })

  app.post('/login', { config: authLimiter.config }, async (request, reply) => {
    const body = loginSchema.parse(request.body)
    
    const result = await measureTime('login', () =>
      login(body.email, body.password, {
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request)
      })
    )

    metrics.increment('auth.login')
    return reply.send(result)
  })

  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const authHeader = request.headers.authorization!
    const token = authHeader.substring(7)
    
    await logout(token, request.userId!, {
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    })

    return reply.code(204).send()
  })

  app.post('/verify-email', async (request, reply) => {
    const body = verifyTokenSchema.parse(request.body)
    
    const result = await verifyEmail(
      body.token,
      getClientIp(request),
      getUserAgent(request)
    )

    return reply.send(result)
  })

  app.post('/password-reset/request', async (request, reply) => {
    const body = passwordResetRequestSchema.parse(request.body)
    
    const result = await createPasswordReset(body.email)

    if (result.sent) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
      await sendPasswordResetEmail(result.email!, result.token!, baseUrl)
    }

    return reply.send({ 
      success: true,
      message: 'If the email exists, a reset link has been sent'
    })
  })

  app.post('/password-reset/confirm', async (request, reply) => {
    const body = passwordResetSchema.parse(request.body)
    
    const result = await resetPassword(
      body.token,
      body.password,
      getClientIp(request),
      getUserAgent(request)
    )

    return reply.send(result)
  })

  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body)
    
    const accessToken = await refreshAccess(body.refreshToken)

    return reply.send({ accessToken })
  })

  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await queries.findUserById(request.userId!)

    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    return reply.send({
      id: user.id,
      email: user.email,
      verified: user.verified,
      createdAt: user.created_at
    })
  })

  app.get('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const sessions = await getUserActiveSessions(request.userId!)

    return reply.send({
      sessions: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        createdAt: s.created_at,
        lastActive: s.last_active,
        current: request.headers.authorization?.substring(7) === s.token
      }))
    })
  })

  app.delete('/sessions/:sessionId', { preHandler: authenticate }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    
    const session = await queries.findSessionById(sessionId)
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' })
    }

    if (session.user_id !== request.userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    await queries.deleteSession(session.token)
    cache.delete(`session:${session.token}`)

    return reply.code(204).send()
  })

  app.delete('/sessions', { preHandler: authenticate }, async (request, reply) => {
    await revokeAllUserSessions(request.userId!)

    return reply.code(204).send()
  })

  app.post('/totp/enable', { preHandler: authenticate }, async (request, reply) => {
    const user = await queries.findUserById(request.userId!)
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const result = await enableTOTP(request.userId!, user.email)
    return reply.send(result)
  })

  app.post('/totp/verify', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.body as { code: string }
    const result = await verifyTOTP(request.userId!, code)
    return reply.send(result)
  })

  app.post('/totp/confirm', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.body as { code: string }
    const result = await confirmTOTP(request.userId!, code)
    return reply.send(result)
  })

  app.delete('/totp', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.body as { code: string }
    const result = await disableTOTP(request.userId!, code)
    return reply.send(result)
  })

  app.get('/auth/google', async (request, reply) => {
    const state = generateSecureToken()
    const url = getGoogleOAuthUrl(state)
    return reply.send({ url, state })
  })

  app.get('/auth/github', async (request, reply) => {
    const state = generateSecureToken()
    const url = getGitHubOAuthUrl(state)
    return reply.send({ url, state })
  })

  app.get('/auth/google/callback', async (request, reply) => {
    const { code } = request.query as { code: string }
    const userInfo = await exchangeGoogleCode(code)
    const result = await handleOAuthCallback(userInfo, {
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    })
    return reply.send(result)
  })

  app.get('/auth/github/callback', async (request, reply) => {
    const { code } = request.query as { code: string }
    const userInfo = await exchangeGitHubCode(code)
    const result = await handleOAuthCallback(userInfo, {
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    })
    return reply.send(result)
  })

  app.post('/webauthn/register/start', { preHandler: authenticate }, async (request, reply) => {
    const user = await queries.findUserById(request.userId!)
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const options = await generateRegistration(request.userId!, user.email)
    return reply.send(options)
  })

  app.post('/webauthn/register/finish', { preHandler: authenticate }, async (request, reply) => {
    const { response } = request.body as any
    const result = await verifyRegistration(request.userId!, response)
    return reply.send(result)
  })

  app.post('/webauthn/login/start', async (request, reply) => {
    const { email } = request.body as { email: string }
    const { options, userId } = await generateAuthentication(email)
    return reply.send({ options, userId })
  })

  app.post('/webauthn/login/finish', async (request, reply) => {
    const { userId, response } = request.body as any
    const result = await verifyAuthentication(userId, response)
    
    if (result.verified) {
      const user = await queries.findUserById(userId)
      if (!user) return reply.code(404).send({ error: 'User not found' })

      const { createSession } = await import('../core/sessions.js')
      const { createAccessToken } = await import('../core/tokens.js')

      const session = await createSession(userId, {
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request)
      })
      const accessToken = createAccessToken(userId, user.email)

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          verified: user.verified
        },
        accessToken,
        refreshToken: session.token
      })
    }

    return reply.code(401).send({ error: 'Authentication failed' })
  })

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }))

  app.get('/metrics', async (request, reply) => {
    const authHeader = request.headers['x-metrics-key']
    if (!process.env.METRICS_KEY || authHeader !== process.env.METRICS_KEY) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    return {
      ...metrics.getAll(),
      cache: cache.stats(),
      timestamp: Date.now()
    }
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError) {
      metrics.increment(`auth.error.${error.code}`)
      
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return reply.code(429).send({
          error: error.message,
          code: error.code
        })
      }
      
      return reply.code(401).send({
        error: error.message,
        code: error.code
      })
    }

    if (error.validation) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: error.validation
      })
    }

    console.error('Unhandled error:', error)
    metrics.increment('errors.unhandled')
    
    return reply.code(500).send({
      error: 'Internal server error'
    })
  })
}
