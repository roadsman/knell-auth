import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from '../core/tokens.js'
import { errors } from '../lib/errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    userEmail?: string
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw errors.unauthorized()
  }

  const token = authHeader.substring(7)
  const payload = verifyAccessToken(token)

  if (!payload) {
    throw errors.unauthorized()
  }

  request.userId = payload.userId
  request.userEmail = payload.email
}

export function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return request.ip
}

export function getUserAgent(request: FastifyRequest): string {
  return request.headers['user-agent'] || 'unknown'
}
