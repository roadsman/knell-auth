# Security Features

## Protection Against OWASP Top 10 Auth Vulnerabilities

### 1. Credential Stuffing & Password Spraying

**Protections:**
- Adaptive rate limiting (5 attempts per 15min on auth endpoints)
- Account lockout after 5 failed attempts (15min duration)
- IP-based blocking with Bloom filter for O(1) lookup
- Failed attempt tracking per email and IP
- Audit logging of all authentication attempts

**Implementation:**
```typescript
// Adaptive rate limiter auto-throttles on high failure rates
// Account locks persist across requests via database
// IP blocks use memory-efficient Bloom filters
```

### 2. Brute-Force & Enumeration Attacks

**Protections:**
- **Timing attack mitigation**: Constant-time comparisons for tokens
- **Response uniformity**: Same error message for invalid email/password
- **Artificial delays**: Random 100-500ms delay on auth failures
- **No user enumeration**: "Invalid credentials" for both missing users and wrong passwords
- **Registration obfuscation**: Same response time whether email exists or not

**Code:**
```typescript
// Always returns "Invalid credentials" - never reveals if user exists
// Timing is constant regardless of validation path
await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))
```

### 3. Weak or Default Credentials

**Protections:**
- Minimum 12 character passwords
- Complexity requirements (uppercase, lowercase, numbers, symbols)
- Common password blocking (30+ entries via Bloom filter)
- Password strength scoring
- No default credentials shipped

**Validation:**
```typescript
// Blocks: password123, admin, root, etc.
// Requires 3/4 character classes
// Rejects dictionary words
```

### 4. Missing or Flawed MFA

**Current State:**
- Single-factor (password) only
- MFA/TOTP planned for v2

**Mitigations:**
- Strong password requirements
- Device fingerprinting per session
- Session monitoring across devices
- Suspicious activity detection via audit logs

### 5. Insecure Password Recovery

**Protections:**
- Cryptographically random tokens (32 bytes)
- Time-limited verification tokens (24h expiration)
- One-time use tokens (deleted after use)
- No predictable security questions
- Tokens stored hashed in database

**Schema:**
```sql
verification_tokens: token (unique, indexed), expires_at, type
```

### 6. Poor Session Management

**Protections:**
- Cryptographically secure session tokens (64 hex characters)
- Short-lived access tokens (15min JWT)
- Long-lived refresh tokens (7 days, revocable)
- Session expiration enforcement
- Explicit logout invalidates tokens
- "Revoke all sessions" capability
- Session tracking with last_active timestamp
- Maximum concurrent sessions (5 per user)
- Device fingerprinting (IP + User-Agent hash)

**Implementation:**
```typescript
// Sessions stored server-side, not in URLs
// Token rotation on refresh
// Automatic cleanup of expired sessions
```

### 7. Broken Object Level Authorization (BOLA/IDOR)

**Protections:**
- **Explicit ownership checks** on every resource access
- User ID from JWT, never from request body
- Session deletion requires ownership verification
- User data queries filtered by authenticated user ID

**Example:**
```typescript
// /sessions/:id - verifies session.user_id === request.userId
if (session.user_id !== request.userId) {
  return reply.code(403).send({ error: 'Forbidden' })
}
```

### 8. JWT Validation Flaws

**Protections:**
- **Algorithm whitelist**: Only HS256 allowed
- **Issuer validation**: Must be "knell-auth"
- **Audience validation**: Must be "knell-api"
- **Expiration check**: 15min token lifetime
- **Clock tolerance**: 10s skew allowed
- **Required claims**: userId and email must exist
- **Signature verification**: Always checked

**Configuration:**
```typescript
jwt.verify(token, secret, {
  algorithms: ['HS256'],
  issuer: 'knell-auth',
  audience: 'knell-api',
  clockTolerance: 10
})
```

### 9. Overprivileged Accounts

**Design:**
- No role system in v1 (single-tenant, user owns their data only)
- All users have equal privileges
- No admin/superuser concept
- Future RBAC planned with principle of least privilege

### 10. Session Fixation

**Protections:**
- New session token generated on every login
- Old sessions not reused
- Session tokens never in URLs
- Secure token generation (crypto.randomBytes)

## Additional Security Measures

### Input Validation
- Zod schemas for all endpoints
- Email format validation
- SQL injection prevention (parameterized queries)
- Body size limits (1MB max)
- Parameter length limits (100 chars)

### Transport Security
- HTTPS only (enforced via HSTS headers)
- Secure cookies (when used)
- CORS configuration
- Helmet.js security headers
- CSP disabled for API-only service

### Monitoring & Audit
- All auth events logged with IP/User-Agent
- Failed login attempts tracked
- Account locks recorded
- Audit log retention (90 days)
- Metrics endpoint for monitoring (protected)

### Database Security
- Prepared statements (SQL injection protection)
- Connection pooling with limits
- Least privilege database user
- Encrypted password hashes (Argon2id)
- No plaintext secrets in database

### Deployment Security
- Environment variable configuration
- No hardcoded secrets
- Docker security best practices
- Graceful shutdown handling
- Health check endpoints

## Vulnerability Reporting

Found a security issue? Please report it privately using GitHub's Security Advisory feature:

https://github.com/roadsman/knell-auth/security/advisories/new

**Please do not open public GitHub issues for security vulnerabilities.**

We follow responsible disclosure:
1. Report privately
2. We investigate (typically 48h response)
3. We patch (1-7 days depending on severity)
4. Public disclosure after fix is deployed

## Security Roadmap

**v2 Planned:**
- TOTP-based MFA
- WebAuthn/FIDO2 support
- OAuth 2.0 provider support
- Rate limiting per user ID
- Anomaly detection (login from new location)
- Password breach checking (HaveIBeenPwned API)
- Security headers report-uri
- Encrypted audit logs

**v3 Planned:**
- Zero-knowledge architecture
- End-to-end encryption for PII
- Hardware security module (HSM) integration
- Advanced threat detection
- Compliance certifications (SOC2, ISO 27001)
