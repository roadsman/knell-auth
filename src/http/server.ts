import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import { config } from '../config.js'
import { registerRoutes } from './routes.js'
import { registerAdminRoutes } from './admin.js'

export async function createServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'production' ? {
      level: 'error',
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.ip
        })
      }
    } : true,
    trustProxy: true,
    disableRequestLogging: process.env.NODE_ENV === 'production',
    ignoreTrailingSlash: true,
    keepAliveTimeout: 65000,
    requestIdLogLabel: 'reqId',
    maxParamLength: 100,
    bodyLimit: 1048576,
    caseSensitive: false,
    http2: false,
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        useDefaults: true
      }
    }
  })

  app.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now()
  })

  app.addHook('onResponse', async (request, reply) => {
    if (request.startTime) {
      const duration = Date.now() - request.startTime
      metrics.recordTiming('http.request.duration', duration)
      metrics.recordTiming(`http.${request.method}.${reply.statusCode}`, duration)
    }
  })

  declare module 'fastify' {
    interface FastifyRequest {
      startTime?: number
    }
  }

  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })

  await app.register(cors, {
    origin: true,
    credentials: true
  })

  await app.register(rateLimit, {
    max: config.rateLimit.global.max,
    timeWindow: config.rateLimit.global.window,
    cache: 10000,
    errorResponseBuilder: () => ({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    })
  })

  await registerRoutes(app)
  await registerAdminRoutes(app)

  return app
}

export async function startServer() {
  const app = await createServer()

  try {
    await app.listen({
      port: config.port,
      host: '0.0.0.0'
    })
    console.log(`Server running on port ${config.port}`)
    return app
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}
