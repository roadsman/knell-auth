import { config } from '../config.js'

export interface EmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!config.email.enabled) {
    console.log('[Email] Would send:', {
      to: options.to,
      subject: options.subject
    })
    console.log('[Email] Body:', options.text)
    return true
  }

  return true
}

export async function sendVerificationEmail(email: string, token: string, baseUrl: string) {
  const verifyUrl = `${baseUrl}/verify?token=${token}`
  
  return sendEmail({
    to: email,
    subject: 'Verify your email',
    text: `Click this link to verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Click the link below to verify your email:</p>
      <p><a href="${verifyUrl}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't request this, ignore this email.</p>
    `
  })
}

export async function sendPasswordResetEmail(email: string, token: string, baseUrl: string) {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  
  return sendEmail({
    to: email,
    subject: 'Reset your password',
    text: `Click this link to reset your password: ${resetUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't request this, ignore this email.</p>
    `
  })
}
