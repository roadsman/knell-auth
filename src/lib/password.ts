import { z } from 'zod'
import { commonPasswordFilter } from './bloom.js'

export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 128

const commonPasswords = [
  'password', 'password123', '123456', '12345678', 'qwerty', 
  'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
  'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', 'superman',
  'welcome', 'login', 'admin', 'root', 'toor', 'pass',
  'test', 'guest', 'info', 'adm', 'mysql', 'user',
  'administrator', 'oracle', 'ftp', 'pi', 'puppet',
  'ansible', 'ec2-user', 'vagrant', 'azureuser', 'master123'
]

for (const pwd of commonPasswords) {
  commonPasswordFilter.add(pwd)
}

export interface PasswordStrength {
  valid: boolean
  score: number
  feedback: string[]
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      score: 0,
      feedback: [`Password must contain at least ${MIN_PASSWORD_LENGTH} characters`]
    }
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      score: 0,
      feedback: [`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`]
    }
  }

  if (commonPasswordFilter.has(password.toLowerCase())) {
    return {
      valid: false,
      score: 0,
      feedback: ['Password is too common and easily guessable']
    }
  }

  if (/[a-z]/.test(password)) score += 1
  else feedback.push('Include lowercase letters')

  if (/[A-Z]/.test(password)) score += 1
  else feedback.push('Include uppercase letters')

  if (/[0-9]/.test(password)) score += 1
  else feedback.push('Include numbers')

  if (/[^a-zA-Z0-9]/.test(password)) score += 1
  else feedback.push('Include special characters')

  if (password.length >= 16) score += 1

  const valid = score >= 3

  return { valid, score, feedback }
}

export const passwordSchema = z.string()
  .min(MIN_PASSWORD_LENGTH, `Password must contain at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`)
  .refine(
    (password) => validatePasswordStrength(password).valid,
    (password) => ({ message: validatePasswordStrength(password).feedback.join('. ') })
  )
