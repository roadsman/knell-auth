export const config = {
  port: parseInt(process.env.PORT || '3000'),
  database: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/knell',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000')
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256' as const
  },
  session: {
    duration: parseInt(process.env.SESSION_DURATION || String(7 * 24 * 60 * 60 * 1000)),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5')
  },
  verification: {
    tokenDuration: parseInt(process.env.VERIFICATION_TOKEN_DURATION || String(24 * 60 * 60 * 1000))
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@knell.local',
    enabled: process.env.EMAIL_ENABLED === 'true'
  },
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || String(15 * 60 * 1000)),
    attemptWindow: parseInt(process.env.ATTEMPT_WINDOW || String(15 * 60 * 1000)),
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
  },
  rateLimit: {
    global: {
      max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '100'),
      window: process.env.RATE_LIMIT_GLOBAL_WINDOW || '15m'
    },
    auth: {
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5'),
      window: process.env.RATE_LIMIT_AUTH_WINDOW || '15m'
    }
  }
}
