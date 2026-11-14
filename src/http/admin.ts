import { FastifyInstance } from 'fastify'
import { queries } from '../data/queries.js'
import { sql } from '../data/db.js'
import { authenticate } from './middleware.js'
import { blockIp } from '../lib/security.js'

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get('/admin/stats', { preHandler: authenticate }, async (request, reply) => {
    const [userCount] = await sql`select count(*) as count from users`
    const [sessionCount] = await sql`select count(*) as count from sessions where expires_at > now()`
    const [verifiedCount] = await sql`select count(*) as count from users where verified = true`
    
    const recentSignups = await sql`
      select date_trunc('day', created_at) as date, count(*) as count
      from users
      where created_at > now() - interval '30 days'
      group by date_trunc('day', created_at)
      order by date desc
    `

    const recentLogins = await sql`
      select date_trunc('day', created_at) as date, count(*) as count
      from login_attempts
      where created_at > now() - interval '30 days' and success = true
      group by date_trunc('day', created_at)
      order by date desc
    `

    return reply.send({
      users: {
        total: parseInt(userCount.count),
        verified: parseInt(verifiedCount.count),
        unverified: parseInt(userCount.count) - parseInt(verifiedCount.count)
      },
      sessions: {
        active: parseInt(sessionCount.count)
      },
      signups: recentSignups,
      logins: recentLogins
    })
  })

  app.get('/admin/users', { preHandler: authenticate }, async (request, reply) => {
    const { page = 1, limit = 50 } = request.query as { page?: number, limit?: number }
    const offset = (page - 1) * limit

    const users = await sql`
      select id, email, verified, created_at, updated_at
      from users
      order by created_at desc
      limit ${limit} offset ${offset}
    `

    const [total] = await sql`select count(*) as count from users`

    return reply.send({
      users,
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        pages: Math.ceil(parseInt(total.count) / limit)
      }
    })
  })

  app.get('/admin/audit-logs', { preHandler: authenticate }, async (request, reply) => {
    const { page = 1, limit = 100, userId } = request.query as { page?: number, limit?: number, userId?: string }
    const offset = (page - 1) * limit

    const logs = userId
      ? await sql`
          select * from audit_logs
          where user_id = ${userId}
          order by created_at desc
          limit ${limit} offset ${offset}
        `
      : await sql`
          select * from audit_logs
          order by created_at desc
          limit ${limit} offset ${offset}
        `

    const [total] = userId
      ? await sql`select count(*) as count from audit_logs where user_id = ${userId}`
      : await sql`select count(*) as count from audit_logs`

    return reply.send({
      logs,
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        pages: Math.ceil(parseInt(total.count) / limit)
      }
    })
  })

  app.post('/admin/block-ip', { preHandler: authenticate }, async (request, reply) => {
    const { ipAddress, reason, duration } = request.body as { 
      ipAddress: string
      reason: string
      duration?: number
    }

    await blockIp(ipAddress, reason, duration)

    return reply.send({ success: true })
  })

  app.get('/admin/blocked-ips', { preHandler: authenticate }, async (request, reply) => {
    const blocked = await sql`
      select * from ip_blocklist
      where blocked_until is null or blocked_until > now()
      order by created_at desc
    `

    return reply.send({ blocked })
  })

  app.get('/admin/failed-attempts', { preHandler: authenticate }, async (request, reply) => {
    const { hours = 24 } = request.query as { hours?: number }
    
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    const attempts = await sql`
      select 
        email,
        ip_address,
        count(*) as attempts,
        max(created_at) as last_attempt
      from login_attempts
      where success = false and created_at > ${cutoff}
      group by email, ip_address
      having count(*) >= 3
      order by count(*) desc, last_attempt desc
    `

    return reply.send({ attempts })
  })
}
