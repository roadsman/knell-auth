import { z } from 'zod'
import { passwordSchema } from '../lib/password.js'

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

export const emailSchema = z.object({
  email: z.string().email('Invalid email address')
})

export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required')
})
