import { sql } from './db.js'
import { BatchProcessor } from '../lib/batch.js'

const userByIdBatcher = new BatchProcessor<User>(async (ids) => {
  const users = await sql<User[]>`
    select * from users where id = any(${ids})
  `
  return new Map(users.map(u => [u.id, u]))
})

const userByEmailBatcher = new BatchProcessor<User>(async (emails) => {
  const users = await sql<User[]>`
    select * from users where email = any(${emails})
  `
  return new Map(users.map(u => [u.email, u]))
})

export interface User {
  id: string
  email: string
  password_hash: string
  verified: boolean
  created_at: Date
  updated_at: Date
}

export interface Session {
  id: string
  user_id: string
  token: string
  ip_address?: string
  user_agent?: string
  device_fingerprint?: string
  expires_at: Date
  created_at: Date
  last_active: Date
}

export interface VerificationToken {
  id: string
  user_id: string
  token: string
  type: string
  expires_at: Date
  created_at: Date
}

export const queries = {
  async createUser(email: string, passwordHash: string): Promise<User> {
    const [user] = await sql<User[]>`
      insert into users (email, password_hash)
      values (${email}, ${passwordHash})
      returning *
    `
    return user
  },

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      return await userByEmailBatcher.fetch(email)
    } catch {
      return null
    }
  },

  async findUserById(id: string): Promise<User | null> {
    try {
      return await userByIdBatcher.fetch(id)
    } catch {
      return null
    }
  },

  async createSession(
    userId: string, 
    token: string, 
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
    deviceFingerprint?: string
  ): Promise<Session> {
    const [session] = await sql<Session[]>`
      insert into sessions (user_id, token, expires_at, ip_address, user_agent, device_fingerprint)
      values (${userId}, ${token}, ${expiresAt}, ${ipAddress}, ${userAgent}, ${deviceFingerprint})
      returning *
    `
    return session
  },

  async findSessionByToken(token: string): Promise<Session | null> {
    const [session] = await sql<Session[]>`
      select * from sessions 
      where token = ${token} and expires_at > now()
    `
    return session || null
  },

  async updateSessionActivity(sessionId: string): Promise<void> {
    await sql`
      update sessions 
      set last_active = now() 
      where id = ${sessionId}
    `
  },

  async findSessionById(id: string): Promise<Session | null> {
    const [session] = await sql<Session[]>`
      select * from sessions 
      where id = ${id} and expires_at > now()
    `
    return session || null
  },

  async findUserSessions(userId: string): Promise<Session[]> {
    return sql<Session[]>`
      select * from sessions
      where user_id = ${userId} and expires_at > now()
      order by last_active desc
    `
  },

  async deleteSession(token: string): Promise<void> {
    await sql`delete from sessions where token = ${token}`
  },

  async deleteUserSessions(userId: string): Promise<void> {
    await sql`delete from sessions where user_id = ${userId}`
  },

  async createVerificationToken(userId: string, token: string, type: string, expiresAt: Date): Promise<VerificationToken> {
    const [vToken] = await sql<VerificationToken[]>`
      insert into verification_tokens (user_id, token, type, expires_at)
      values (${userId}, ${token}, ${type}, ${expiresAt})
      returning *
    `
    return vToken
  },

  async findVerificationToken(token: string, type: string): Promise<VerificationToken | null> {
    const [vToken] = await sql<VerificationToken[]>`
      select * from verification_tokens
      where token = ${token} and type = ${type} and expires_at > now()
    `
    return vToken || null
  },

  async deleteVerificationToken(token: string): Promise<void> {
    await sql`delete from verification_tokens where token = ${token}`
  },

  async markUserVerified(userId: string): Promise<void> {
    await sql`update users set verified = true where id = ${userId}`
  },

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await sql`
      update users 
      set password_hash = ${passwordHash}, updated_at = now() 
      where id = ${userId}
    `
  }
}
