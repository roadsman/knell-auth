export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const errors = {
  invalidCredentials: () => new AuthError('Invalid credentials', 'INVALID_CREDENTIALS'),
  emailTaken: () => new AuthError('Registration failed', 'REGISTRATION_FAILED'),
  userNotFound: () => new AuthError('Invalid credentials', 'INVALID_CREDENTIALS'),
  invalidToken: () => new AuthError('Invalid or expired token', 'INVALID_TOKEN'),
  unauthorized: () => new AuthError('Unauthorized', 'UNAUTHORIZED'),
  accountLocked: () => new AuthError('Account temporarily locked due to multiple failed attempts', 'ACCOUNT_LOCKED'),
  tooManyRequests: () => new AuthError('Too many requests', 'RATE_LIMIT_EXCEEDED'),
  sessionLimit: () => new AuthError('Maximum concurrent sessions reached', 'SESSION_LIMIT_EXCEEDED')
}
