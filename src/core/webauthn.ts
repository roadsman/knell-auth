import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/types'
import { queries } from '../data/queries.js'
import { logAuditEvent } from '../lib/security.js'

const rpName = 'Knell Auth'
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'

export async function generateRegistration(userId: string, email: string) {
  const user = await queries.findUserById(userId)
  if (!user) throw new Error('User not found')

  const userCredentials = await queries.findWebAuthnCredentials(userId)

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: email,
    attestationType: 'none',
    excludeCredentials: userCredentials.map(cred => ({
      id: Buffer.from(cred.id, 'base64url'),
      type: 'public-key' as const,
      transports: cred.transports as any
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred'
    }
  })

  await queries.saveWebAuthnChallenge(userId, options.challenge)

  return options
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON
) {
  const challenge = await queries.getWebAuthnChallenge(userId)
  if (!challenge) throw new Error('Challenge not found')

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Verification failed')
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo

  await queries.saveWebAuthnCredential({
    id: Buffer.from(credentialID).toString('base64url'),
    userId,
    publicKey: Buffer.from(credentialPublicKey),
    counter,
    deviceType: 'unknown',
    transports: []
  })

  await queries.deleteWebAuthnChallenge(userId)
  await logAuditEvent(userId, 'webauthn.registered', null, null)

  return { verified: true }
}

export async function generateAuthentication(email: string) {
  const user = await queries.findUserByEmail(email)
  if (!user) throw new Error('User not found')

  const credentials = await queries.findWebAuthnCredentials(user.id)

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map(cred => ({
      id: Buffer.from(cred.id, 'base64url'),
      type: 'public-key' as const,
      transports: cred.transports as any
    })),
    userVerification: 'preferred'
  })

  await queries.saveWebAuthnChallenge(user.id, options.challenge)

  return { options, userId: user.id }
}

export async function verifyAuthentication(
  userId: string,
  response: AuthenticationResponseJSON
) {
  const challenge = await queries.getWebAuthnChallenge(userId)
  if (!challenge) throw new Error('Challenge not found')

  const credentialId = response.id
  const credential = await queries.findWebAuthnCredential(credentialId)
  
  if (!credential || credential.user_id !== userId) {
    throw new Error('Credential not found')
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: Buffer.from(credential.id, 'base64url'),
      credentialPublicKey: credential.public_key,
      counter: Number(credential.counter)
    }
  })

  if (!verification.verified) {
    throw new Error('Verification failed')
  }

  await queries.updateWebAuthnCounter(credentialId, verification.authenticationInfo.newCounter)
  await queries.deleteWebAuthnChallenge(userId)
  await logAuditEvent(userId, 'webauthn.authenticated', null, null)

  return { verified: true, userId }
}

