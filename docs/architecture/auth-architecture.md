# Auth Module — System Architecture

**Version:** 1.0.0  
**Module:** AUTH  
**Stack:** Go 1.22 + Fiber · Next.js 15 · PostgreSQL 16 · Redis 7  
**Status:** 🔒 Reference Document

---

## Table of Contents

1. [Overview](#1-overview)
2. [Token Strategy](#2-token-strategy)
3. [Cookie Configuration](#3-cookie-configuration)
4. [Auth Flows](#4-auth-flows)
   - [4.1 Email Registration](#41-email-registration)
   - [4.2 Email Verification](#42-email-verification)
   - [4.3 Email Login (no 2FA)](#43-email-login-no-2fa)
   - [4.4 Email Login (with 2FA)](#44-email-login-with-2fa)
   - [4.5 Google OAuth](#45-google-oauth)
   - [4.6 Silent Token Refresh](#46-silent-token-refresh)
   - [4.7 Password Reset](#47-password-reset)
   - [4.8 Logout](#48-logout)
5. [JWT Specification](#5-jwt-specification)
6. [Redis Key Reference](#6-redis-key-reference)
7. [Database Schema](#7-database-schema)
8. [API Endpoints](#8-api-endpoints)
9. [Middleware Chain](#9-middleware-chain)
10. [Go Module Structure](#10-go-module-structure)
11. [Next.js Auth Structure](#11-nextjs-auth-structure)
12. [Security Design Decisions](#12-security-design-decisions)

---

## 1. Overview

The auth module handles all identity and session concerns for the platform. It serves three user types under one unified token strategy: **B2B org members**, **B2C individual users**, and **platform admins**.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ BROWSER                                                             │
│  Next.js Client Components · httpOnly Cookies · No JS token access │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS · cookies
┌───────────────────────────▼─────────────────────────────────────────┐
│ NEXT.JS (Server)                                                    │
│  Edge Middleware (route protection + silent refresh)                │
│  Server Actions (all auth form submissions)                         │
│  Server Components (session-aware page rendering)                   │
└──────────┬─────────────────────────────────────────────────────────┘
           │ HTTP/2 · JSON
┌──────────▼──────────────────────────────────────────────────────────┐
│ GO AUTH SERVICE                                                     │
│  Rate Limiter → Auth Handler → Use Case → Repository                │
│  JWT Service · TOTP Service · OAuth Service · Email Service         │
│  Crypto Service · Session Service                                   │
└──────┬────────────────────┬──────────────────────┬──────────────────┘
       │                    │                      │
┌──────▼───────┐  ┌─────────▼────────┐  ┌─────────▼──────────────────┐
│ PostgreSQL   │  │ Redis 7          │  │ External                   │
│              │  │                  │  │                            │
│ users        │  │ refresh sessions │  │ Resend (email)             │
│ credentials  │  │ blacklist        │  │ Google OAuth API           │
│ oauth_accts  │  │ 2fa pending      │  │                            │
│ email_tokens │  │ rate limits      │  │                            │
│ reset_tokens │  │ oauth state      │  │                            │
└──────────────┘  └──────────────────┘  └────────────────────────────┘
```

### Design Principles

- **Stateless access, stateful refresh.** JWT access token needs no DB lookup. Refresh token in Redis enables instant revocation.
- **No tokens in JavaScript.** All tokens live in httpOnly cookies — XSS cannot steal them.
- **Narrow cookie paths.** Each token cookie is scoped to only the endpoints it needs to reach.
- **Hash-before-store.** Email verification, password reset, and refresh tokens are stored as SHA-256 hashes — raw tokens only exist transiently.
- **Anti-enumeration by default.** Auth endpoints reveal the minimum information necessary.

---

## 2. Token Strategy

| Token | Type | Lifetime | Storage | Path |
|-------|------|----------|---------|------|
| `access_token` | JWT (RS256) | 15 minutes | httpOnly cookie | `/api` |
| `refresh_token` | Opaque (32-byte hex) | 7 days | httpOnly cookie + Redis | `/api/v1/auth/refresh` |
| `2fa_pending_token` | Opaque (UUID) | 5 minutes | httpOnly cookie + Redis | `/api/v1/auth/2fa` |

### How They Work Together

```
Login ──────────────────────────────────────────────────────────────────────────▶
         │ access_token (15 min)         │ refresh_token (7 days)
         │ used on every API call        │ used only at refresh endpoint
         │                              │
         ▼ expires                       ▼ rotates silently (Next.js middleware)
         Next.js Middleware detects near-expiry (< 2 min) 
         → silently calls /auth/refresh server-to-server
         → new access_token + new refresh_token issued (rotation)
         → old refresh_token immediately invalidated
         → browser receives new cookies transparently
```

### Refresh Token Rotation

Every refresh call issues a **new** refresh token and immediately **invalidates** the old one. This means:

- A stolen refresh token is self-detecting: when the attacker uses it, the legitimate user's next refresh fails (old token gone), forcing re-login and surfacing the breach.
- Each token is single-use for refresh purposes.

---

## 3. Cookie Configuration

All auth cookies share these base attributes:

| Attribute | Value | Reason |
|-----------|-------|--------|
| `HttpOnly` | `true` | JavaScript cannot access — XSS-proof |
| `Secure` | `true` | HTTPS only — no cleartext transmission |
| `SameSite` | `Strict` | Not sent on cross-site requests — CSRF protection |
| `Domain` | `.platform.com` | Shared across org subdomains |

Path configuration per token:

```
Set-Cookie: access_token={jwt};     HttpOnly; Secure; SameSite=Strict; Path=/api;                    Max-Age=900
Set-Cookie: refresh_token={opaque}; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh;    Max-Age=604800
Set-Cookie: 2fa_pending={uuid};     HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/2fa;        Max-Age=300
```

> **Critical:** The `refresh_token` cookie path `/api/v1/auth/refresh` means the browser never sends it to any other endpoint. The `2fa_pending_token` is even narrower — only reaches the 2FA challenge endpoint. These path restrictions are a structural, zero-cost defense-in-depth layer.

---

## 4. Auth Flows

### Layer Reference

| Label | Component |
|-------|-----------|
| `[BROWSER]` | Client-side Next.js or user interaction |
| `[NEXT.JS]` | Next.js Server Action, Middleware, or Page Route |
| `[GO]` | Go Fiber handler, use case, or service |
| `[POSTGRES]` | PostgreSQL via sqlc repository |
| `[REDIS]` | Redis operation |
| `[EXTERNAL]` | Third-party API (Google, Resend) |

---

### 4.1 Email Registration

**Summary:** User submits email + password → verification email sent → account created (unverified) → cannot login until verified.

```
[BROWSER]   User submits registration form: { email, name, password }
[NEXT.JS]   Server Action validates with Zod client-side first
[NEXT.JS]   POST /api/v1/auth/register (server-side fetch; cookies forwarded)
[GO]        Rate limiter: max 3 registrations / IP / 10 min
              → Redis: INCR rate:register:{ip}; EXPIRE 600
              → Return 429 if limit exceeded
[GO]        Validate input schema (go-playground/validator)
              → Return 422 with field-level errors on failure
[POSTGRES]  SELECT WHERE email = $1
              → Return 409 Conflict if already registered
[GO]        Hash password: bcrypt.GenerateFromPassword(password, cost=12) → ~300ms
[POSTGRES]  INSERT users { id=UUIDv7, email, name, status=active, email_verified_at=NULL }
[POSTGRES]  INSERT user_credentials { user_id, password_hash }
              (separate table from identity; single-responsibility)
[GO]        Generate verification token:
              raw_token = crypto/rand 32 bytes → hex string
              token_hash = SHA-256(raw_token)
              ← Raw token sent via email. Hash stored in DB. Never store raw.
[POSTGRES]  INSERT email_verifications { user_id, token_hash, expires_at=NOW()+24h }
[EXTERNAL]  Resend API: send verification email
              → Subject: "Verify your email"
              → Link: https://platform.com/verify-email?token={raw_token}
[NEXT.JS]   Server Action returns 201 → redirect /check-email
              ← No tokens issued. Account exists but is unverified.
```

> **Design note:** Account is created immediately but marked unverified (`email_verified_at = NULL`). Login is blocked until verified. This prevents email typos from creating orphaned accounts that block the real email owner from registering later.

---

### 4.2 Email Verification

**Summary:** User clicks link in inbox → token validated → account marked verified → redirect to login.

```
[BROWSER]   User opens inbox, clicks verification link
              → GET /verify-email?token={raw_token}
[NEXT.JS]   Page Route Handler: extract token from URL
[NEXT.JS]   POST /api/v1/auth/verify-email { token: raw_token } (server-side)
[GO]        Compute: token_hash = SHA-256(raw_token)
              ← Never compare raw tokens; always compare hashes
[POSTGRES]  SELECT FROM email_verifications
              WHERE token_hash = $1
                AND used_at IS NULL
                AND expires_at > NOW()
              → Return 400 Bad Request if any condition fails
[POSTGRES]  UPDATE users SET email_verified_at = NOW() WHERE id = $1
[POSTGRES]  UPDATE email_verifications SET used_at = NOW()
              ← Token is now permanently consumed (single-use enforced)
[NEXT.JS]   Redirect → /login?verified=true
              ← Login page shows: "Email verified — you can now log in"
```

---

### 4.3 Email Login (no 2FA)

**Summary:** Credentials validated → guards checked → tokens issued → httpOnly cookies set → dashboard.

```
[BROWSER]   User submits login form: { email, password }
[NEXT.JS]   Server Action: POST /api/v1/auth/login
[GO]        Rate limiter: max 5 login attempts / IP / 10 min
              → Redis: INCR rate:login:{ip}; EXPIRE 600
              → Return 429 if limit exceeded
[POSTGRES]  SELECT * FROM users WHERE email = $1
              → Return generic 401 if not found
              ← Same error message as wrong password (anti-enumeration)
[GO]        bcrypt.CompareHashAndPassword(stored_hash, submitted_password)
              → Return 401 on mismatch
              ← Same ~300ms whether user exists or not (constant-time)
[GO]        Guard: email_verified_at NOT NULL
              → Return 403 + "resend verification" link if unverified
[GO]        Guard: user.status == 'active'
              → Return 403 if suspended
[GO]        Check: credential.totp_enabled
              → If TRUE: stop here, branch to 2FA flow (§4.4)
[GO]        JWT Service: sign access_token (RS256, 15 min)
              Claims: { sub, email, name, role, org_id, org_role, type=access, jti, iat, exp }
[GO]        Session Service:
              session_id = UUID v4
              refresh_token_raw = crypto/rand 32 bytes → hex
              refresh_token_hash = SHA-256(refresh_token_raw)
[REDIS]     SET refresh:{user_id}:{session_id}
              → value: { issued_at, user_agent, ip, expires_at }
              → TTL: 7 days
[GO]        Set-Cookie: access_token={jwt}      HttpOnly Path=/api Max-Age=900
[GO]        Set-Cookie: refresh_token={raw_hex} HttpOnly Path=/api/v1/auth/refresh Max-Age=604800
              ← Cookies contain raw values; hashes live in Redis/DB
[NEXT.JS]   Forward Set-Cookie headers → redirect /dashboard
```

---

### 4.4 Email Login (with 2FA)

**Summary:** Password validated → pending token issued (not full tokens) → TOTP challenged → full tokens issued on success.

```
Steps 1–7: Identical to §4.3 Email Login

[GO]        credential.totp_enabled = TRUE detected
              ← Do NOT issue access_token or refresh_token yet
[GO]        Generate: 2fa_pending_token = UUID v4
[REDIS]     SET 2fa:pending:{2fa_pending_token}
              → value: { user_id }
              → TTL: 5 minutes
              ← Short window; user must complete TOTP promptly
[GO]        Set-Cookie: 2fa_pending_token={uuid}
              HttpOnly; Path=/api/v1/auth/2fa; Max-Age=300
              ← Narrow path: cookie never sent to other endpoints
[GO]        Response: 200 { requires_2fa: true }
              ← No resource-access tokens issued
[NEXT.JS]   Server Action receives requires_2fa=true → redirect /auth/2fa-challenge

─── User opens authenticator app, reads 6-digit code ───────────────────────────

[BROWSER]   User submits TOTP code on /auth/2fa-challenge
[NEXT.JS]   Server Action: POST /api/v1/auth/2fa/challenge { code }
              ← 2fa_pending_token cookie attached (path matches)
[GO]        Read 2fa_pending_token from cookie
[REDIS]     GET 2fa:pending:{token} → { user_id }; then DEL (single-use)
              → Return 401 if not found (expired or already used)
[REDIS]     Rate limiter: max 5 TOTP attempts / pending_token / 5 min
              → INCR rate:2fa:{token}; Return 429 if ≥ 5
[POSTGRES]  SELECT totp_secret WHERE user_id = $1
[GO]        CryptoService.Decrypt(totp_secret)
              ← AES-256-GCM; encryption key from env var (not in DB)
[GO]        TOTP Service: totp.ValidateCustom(code, decrypted_secret, time.Now(), opts)
              → opts.Period=30, opts.Digits=6, opts.Window=1 (±1 step = ±30s drift)
              → If backup code format: verify against bcrypt-hashed backup codes
              → Return 401 on mismatch
[GO]        Clear 2fa_pending cookie (Set-Cookie: 2fa_pending_token=""; Max-Age=0)
[GO]        Issue access_token + refresh_token (identical to §4.3 steps 9–14)
[NEXT.JS]   Redirect → /dashboard
```

---

### 4.5 Google OAuth

**Summary:** OAuth 2.0 PKCE flow → find or create user from Google identity → link if email matches existing account.

```
[BROWSER]   User clicks "Continue with Google"
[NEXT.JS]   Server Action: GET /api/v1/auth/google
[GO]        Generate state nonce: crypto/rand 16 bytes → hex
[REDIS]     SET oauth:state:{state_nonce} → "1"; TTL 5 min
              ← CSRF protection: callback must present matching state
[GO]        Build Google OAuth 2.0 URL:
              - response_type=code
              - client_id={GOOGLE_CLIENT_ID}
              - redirect_uri={CALLBACK_URL}
              - scope=openid email profile
              - state={state_nonce}
              - code_challenge={PKCE_challenge}
              - code_challenge_method=S256
[GO]        HTTP 302 → Google OAuth authorization URL
[EXTERNAL]  Google: user authenticates, selects account, grants permissions
[EXTERNAL]  Google: redirects back → GET /api/v1/auth/google/callback?code=X&state=Y
[GO]        Extract state from query param
[REDIS]     GET oauth:state:{state}; then DEL
              → Return 400 Bad Request if state not found (CSRF attempt)
[EXTERNAL]  Google Token API: exchange code + PKCE verifier → Google access_token + id_token
[EXTERNAL]  Google UserInfo API: GET { google_id, email, name, picture_url }
[POSTGRES]  SELECT FROM oauth_accounts
              WHERE provider = 'google' AND provider_id = $1
              ← Primary lookup by stable google_id (doesn't change if user changes email)
[GO]        If not found by provider_id:
              SELECT FROM users WHERE email = $1
              ← Secondary lookup to link with existing password account
[POSTGRES]  If still not found: INSERT user
              { id=UUIDv7, email, name, avatar_url=picture_url,
                status=active, email_verified_at=NOW() }
              ← Google-verified email is pre-verified; no email verification needed
[POSTGRES]  If new OAuth link: INSERT oauth_accounts { user_id, provider=google, provider_id, email }
[GO]        Issue access_token + refresh_token (identical to §4.3 steps 9–14)
[GO]        If new user: Set-Cookie then redirect /onboarding
[GO]        If returning user: Set-Cookie then redirect /dashboard
```

---

### 4.6 Silent Token Refresh

**Summary:** Next.js Edge Middleware detects near-expiry access tokens and refreshes them transparently before forwarding the original request.

```
[NEXT.JS]   Edge Middleware intercepts every request to protected route
[NEXT.JS]   Read access_token cookie
              → Decode JWT (no signature verify — lightweight on Edge Runtime)
              → Extract exp claim
[NEXT.JS]   If access_token absent → redirect /login
[NEXT.JS]   If exp < now + 120 seconds (within 2-min buffer):
              → Trigger silent refresh (before forwarding original request)
[NEXT.JS]   Server-to-server: fetch /api/v1/auth/refresh
              → Passes refresh_token cookie (path matches: /api/v1/auth/refresh)
[GO]        Rate limiter: max 30 refreshes / user / hour (prevent abuse)
[GO]        Read refresh_token cookie (raw hex value)
[GO]        Compute: refresh_token_hash = SHA-256(raw_token)
[GO]        Extract user_id + session_id from cookie metadata
              ← session_id stored alongside refresh_token in a companion cookie OR derived from JWT jti
[REDIS]     GET refresh:{user_id}:{session_id}
              → Return 401 if not found (expired or already rotated)
[GO]        Validate: record found, TTL not expired, user still active
              → On any failure: return 401 → Next.js middleware redirects /login
[REDIS]     DEL refresh:{user_id}:{session_id}
              ← ROTATION: old token invalidated immediately
[GO]        Issue NEW access_token + NEW refresh_token + NEW session_id
[REDIS]     SET refresh:{user_id}:{new_session_id}; TTL 7 days
[GO]        Set-Cookie: access_token (new); refresh_token (new)
[NEXT.JS]   Edge Middleware: capture new Set-Cookie headers
[NEXT.JS]   Forward original request with new access_token
[NEXT.JS]   Append new Set-Cookie headers to original response
              ← Browser receives new cookies; user is completely unaware this happened
```

---

### 4.7 Password Reset

**Summary:** Forgot password → token emailed → password changed → ALL sessions invalidated on all devices.

```
[BROWSER]   User submits email to "Forgot Password" form
[NEXT.JS]   Server Action: POST /api/v1/auth/forgot-password { email }
[GO]        Rate limiter: max 3 reset emails / email / hour
              → Redis: INCR rate:reset:{SHA256(email)}; EXPIRE 3600
              ← Hash the email to avoid storing PII as Redis keys
[GO]        Return 200 OK immediately (synchronous, before looking up user)
              ← Anti-enumeration: response is identical whether email found or not
[POSTGRES]  SELECT FROM users WHERE email = $1 (async, after 200 already sent)
              → If not found: exit silently. No email sent. No error logged.
[GO]        Generate reset token:
              raw_token = crypto/rand 32 bytes → hex
              token_hash = SHA-256(raw_token)
[POSTGRES]  UPDATE existing unused reset tokens: SET used_at = NOW()
              ← Invalidate any pending reset tokens for this user
[POSTGRES]  INSERT password_reset_tokens { user_id, token_hash, expires_at=NOW()+1h }
[EXTERNAL]  Resend API: send reset email
              → Link: https://platform.com/reset-password?token={raw_token}

─── User clicks link (up to 1 hour) ────────────────────────────────────────────

[BROWSER]   User opens /reset-password?token={raw_token}
[NEXT.JS]   Page renders: new password form
[BROWSER]   User submits: { token: raw_token, new_password, confirm_password }
[NEXT.JS]   Server Action: POST /api/v1/auth/reset-password
[GO]        Validate: new_password meets strength requirements
[GO]        Compute: token_hash = SHA-256(submitted_raw_token)
[POSTGRES]  SELECT FROM password_reset_tokens
              WHERE token_hash = $1
                AND used_at IS NULL
                AND expires_at > NOW()
              → Return 400 if not found / expired / already used
[GO]        bcrypt.GenerateFromPassword(new_password, cost=12)
[POSTGRES]  UPDATE user_credentials SET password_hash = $1 WHERE user_id = $2
[POSTGRES]  UPDATE password_reset_tokens SET used_at = NOW()
[REDIS]     SCAN refresh:{user_id}:*
              → DEL all matching keys
              ← ALL sessions on ALL devices are invalidated
              ← User must log in again on every device
[NEXT.JS]   Redirect → /login?reset=success
              ← Login page shows: "Password updated — please log in"
```

> **Why invalidate all sessions?** If someone is resetting their password, it's likely because the old one was compromised. Any session created with the old password may be in attacker hands. Invalidating all sessions ensures the attacker is logged out too.

---

### 4.8 Logout

**Summary:** Current session revoked → access token blacklisted → cookies cleared. Other devices remain logged in.

```
[BROWSER]   User clicks "Log out" (nav or settings)
[NEXT.JS]   Server Action: POST /api/v1/auth/logout
              ← Both cookies forwarded automatically
[GO]        Read access_token cookie → parse JWT → extract: jti, sub (user_id), exp
[GO]        Read refresh_token cookie → extract session_id
              (session_id is stored in a companion httpOnly cookie set at login time)
[REDIS]     DEL refresh:{user_id}:{session_id}
              ← This session only. Other device sessions unaffected.
[REDIS]     SET blacklist:{jti} → "1"
              → TTL = max(0, token_exp - now)  ← remaining lifetime only
              ← Immediate access_token invalidation (checked by auth middleware)
[GO]        Set-Cookie: access_token="";  Max-Age=0  (clear cookie)
[GO]        Set-Cookie: refresh_token=""; Max-Age=0  (clear cookie)
[NEXT.JS]   Redirect → /login
```

> **Why blacklist the access_token?** Without blacklisting, a stolen access token is valid until its 15-minute expiry. The jti blacklist makes logout truly immediate — checked on every request in auth middleware.

---

## 5. JWT Specification

### Algorithm

**RS256** (RSA + SHA-256 asymmetric signing). Private key signs tokens (Go service); public key verifies (Go middleware + Next.js Edge Middleware). Keys rotated quarterly; stored in environment secrets.

### Claims

| Claim | Type | Example | Description |
|-------|------|---------|-------------|
| `sub` | string | `"01957d3a-f4b2-7c00-9e1d-3a5bc6d78e90"` | User ID (UUID v7) |
| `email` | string | `"budi@company.com"` | User email at token issue time |
| `name` | string | `"Budi Santoso"` | Display name |
| `role` | string | `"member"` | Platform role: `admin` · `member` · `b2c` |
| `org_id` | string\|null | `"01957d3b-..."` | Org UUID. `null` for B2C users. |
| `org_role` | string\|null | `"examiner"` | Org role: `owner` · `admin` · `examiner` · `viewer`. `null` for B2C. |
| `type` | string | `"access"` | Token type: `access` · `refresh` |
| `jti` | string | `"01957d3c-..."` | JWT ID (UUID v7). Used as blacklist key on logout. |
| `iat` | number | `1750000000` | Issued at (Unix timestamp) |
| `exp` | number | `1750000900` | Expires at. `iat + 900` for access tokens. |

### Example Decoded Payload

```json
{
  "sub": "01957d3a-f4b2-7c00-9e1d-3a5bc6d78e90",
  "email": "budi@company.com",
  "name": "Budi Santoso",
  "role": "member",
  "org_id": "01957d3b-a2c4-7000-8f1e-2b4cd5e67f89",
  "org_role": "examiner",
  "type": "access",
  "jti": "01957d3c-1234-7000-abcd-ef0123456789",
  "iat": 1750000000,
  "exp": 1750000900
}
```

### Middleware Validation Logic

```
1. Read access_token from cookie
2. If absent → 401 Unauthorized
3. jwt.Parse(token, publicKey) → verify RS256 signature
4. Check claims.exp > now → 401 if expired
5. Redis: GET blacklist:{claims.jti}
   → If found → 401 (token was revoked at logout)
6. Check user still active (optional DB call; cache in Redis for 5 min per user_id)
7. ctx.Locals("user", claims) → available to all downstream handlers
```

---

## 6. Redis Key Reference

| Key Pattern | TTL | Value | Purpose |
|-------------|-----|-------|---------|
| `refresh:{user_id}:{session_id}` | 7 days | `{ issued_at, user_agent, ip, expires_at }` | Active session. One per device/login. DEL on logout or password reset. |
| `blacklist:{jti}` | ≤ 15 min | `"1"` | Revoked access token. TTL = remaining token lifetime. Checked on every auth'd request. |
| `2fa:pending:{token}` | 5 min | `{ user_id }` | 2FA pending state. Single-use (DEL on read). Narrow cookie path — only reaches `/auth/2fa`. |
| `oauth:state:{nonce}` | 5 min | `"1"` | OAuth CSRF nonce. DEL after callback validation. 400 if missing on callback. |
| `rate:login:{ip}` | 10 min | `"count"` | Max 5 login attempts. INCR on every attempt regardless of success. |
| `rate:register:{ip}` | 10 min | `"count"` | Max 3 registrations per IP per 10 min. |
| `rate:reset:{SHA256(email)}` | 1 hour | `"count"` | Max 3 reset emails per email per hour. Hash email for privacy. |
| `rate:2fa:{pending_token}` | 5 min | `"count"` | Max 5 TOTP attempts per pending session. Prevents brute force on 6-digit code. |
| `user:active:{user_id}` | 5 min | `"1"\|"0"` | Cached active-status check. Avoids DB hit on every API request. |

### Rate Limiter Implementation (Sliding Window)

```go
func RateLimit(key string, max int, window time.Duration) error {
    now := time.Now().UnixNano()
    pipe := redis.TxPipeline()
    pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(now-int64(window), 10))
    pipe.ZAdd(ctx, key, &redis.Z{Score: float64(now), Member: now})
    pipe.ZCard(ctx, key)
    pipe.Expire(ctx, key, window)
    results, _ := pipe.Exec(ctx)
    count := results[2].(*redis.IntCmd).Val()
    if count > int64(max) {
        return ErrRateLimitExceeded
    }
    return nil
}
```

---

## 7. Database Schema

### 7.1 `users`

Core user identity. Shared by B2B org members and B2C individuals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | UUID v7 (time-ordered, k-sortable) |
| `email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | Lowercased on insert. Indexed. |
| `name` | `VARCHAR(255)` | `NOT NULL` | Display name |
| `avatar_url` | `TEXT` | `NULLABLE` | S3 URL or Google photo URL |
| `phone` | `VARCHAR(20)` | `NULLABLE` | E.164 format; used for WhatsApp |
| `timezone` | `VARCHAR(50)` | `NOT NULL DEFAULT 'UTC'` | Used for exam datetime display |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'active'` | `active` · `suspended` · `deleted` |
| `email_verified_at` | `TIMESTAMPTZ` | `NULLABLE` | `NULL` = unverified; login blocked |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | Maintained by trigger |

```sql
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(255) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    avatar_url       TEXT,
    phone            VARCHAR(20),
    timezone         VARCHAR(50) NOT NULL DEFAULT 'UTC',
    status           VARCHAR(20) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'suspended', 'deleted')),
    email_verified_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_email ON users (LOWER(email));
CREATE INDEX idx_users_status ON users (status) WHERE status != 'active';
```

---

### 7.2 `user_credentials`

Password hash and TOTP configuration. Separated from `users` for single-responsibility. One row per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK` | |
| `user_id` | `UUID` | `NOT NULL UNIQUE FK → users(id)` | One credential per user |
| `password_hash` | `TEXT` | `NULLABLE` | bcrypt cost 12. `NULL` for OAuth-only accounts. |
| `totp_secret` | `TEXT` | `NULLABLE` | AES-256-GCM encrypted. `NULL` until TOTP setup. |
| `totp_enabled` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | TOTP is set up and active |
| `totp_backup_codes` | `TEXT[]` | `NULLABLE` | Array of 8 bcrypt-hashed codes. Cleared on regeneration. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | |

```sql
CREATE TABLE user_credentials (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    password_hash     TEXT,
    totp_secret       TEXT,
    totp_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    totp_backup_codes TEXT[],
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 7.3 `oauth_accounts`

OAuth provider links. A user may link multiple providers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK` | |
| `user_id` | `UUID` | `NOT NULL FK → users(id)` | |
| `provider` | `VARCHAR(20)` | `NOT NULL` | `'google'` (extensible) |
| `provider_id` | `VARCHAR(255)` | `NOT NULL` | Stable Google user ID |
| `email` | `VARCHAR(255)` | | Provider email at time of link |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

```sql
CREATE TABLE oauth_accounts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     VARCHAR(20) NOT NULL,
    provider_id  VARCHAR(255) NOT NULL,
    email        VARCHAR(255),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_id)
);

CREATE INDEX idx_oauth_user ON oauth_accounts(user_id);
```

---

### 7.4 `email_verifications`

One-time email verification tokens. Expired + used rows purged daily by scheduled Asynq job.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK` | |
| `user_id` | `UUID` | `NOT NULL FK → users(id)` | |
| `token_hash` | `TEXT` | `NOT NULL` | `SHA-256(raw_token)`. Never store raw. |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | `NOW() + 24h` |
| `used_at` | `TIMESTAMPTZ` | `NULLABLE` | `NULL` = unused. Set on use. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

```sql
CREATE TABLE email_verifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ev_token_hash ON email_verifications(token_hash);
CREATE INDEX idx_ev_cleanup ON email_verifications(expires_at) WHERE used_at IS NULL;
```

---

### 7.5 `password_reset_tokens`

Password reset tokens. Identical pattern to email verifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PK` | |
| `user_id` | `UUID` | `NOT NULL FK → users(id)` | |
| `token_hash` | `TEXT` | `NOT NULL` | `SHA-256(raw_token)` |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | `NOW() + 1h` |
| `used_at` | `TIMESTAMPTZ` | `NULLABLE` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

```sql
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_prt_cleanup ON password_reset_tokens(expires_at) WHERE used_at IS NULL;
```

---

### 7.6 Database Maintenance

```sql
-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_credentials_updated_at
BEFORE UPDATE ON user_credentials
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

```go
// Scheduled cleanup job (Asynq, runs nightly at 02:00 UTC)
// Deletes tokens older than 48h that are either used or expired
DELETE FROM email_verifications
WHERE created_at < NOW() - INTERVAL '48 hours';

DELETE FROM password_reset_tokens
WHERE created_at < NOW() - INTERVAL '48 hours';
```

---

## 8. API Endpoints

All endpoints are under `/api/v1/auth`. No auth required unless marked 🔒.

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/auth/register` | — | 3/IP/10min | Register new account |
| `POST` | `/auth/verify-email` | — | — | Verify email token |
| `POST` | `/auth/resend-verification` | — | 2/email/1h | Resend verification email |
| `POST` | `/auth/login` | — | 5/IP/10min | Email/password login |
| `POST` | `/auth/logout` | 🔒 | — | Revoke current session |
| `POST` | `/auth/refresh` | cookie | — | Rotate refresh token |
| `POST` | `/auth/forgot-password` | — | 3/email/1h | Request password reset email |
| `POST` | `/auth/reset-password` | — | 5/token/1h | Submit new password |
| `GET` | `/auth/google` | — | 10/IP/1h | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | — | — | Google OAuth callback |
| `GET` | `/auth/2fa/setup` | 🔒 | — | Generate TOTP secret + QR |
| `POST` | `/auth/2fa/enable` | 🔒 | — | Confirm TOTP code to enable |
| `POST` | `/auth/2fa/challenge` | cookie(2fa) | 5/token/5min | Verify TOTP during login |
| `POST` | `/auth/2fa/disable` | 🔒 | — | Disable TOTP (requires password) |
| `POST` | `/auth/2fa/backup/regenerate` | 🔒 | — | Generate new backup codes |
| `GET` | `/auth/sessions` | 🔒 | — | List active sessions |
| `DELETE` | `/auth/sessions/{session_id}` | 🔒 | — | Revoke specific session |
| `DELETE` | `/auth/sessions` | 🔒 | — | Revoke all sessions (except current) |
| `GET` | `/auth/me` | 🔒 | — | Get current user profile |
| `PATCH` | `/auth/me` | 🔒 | — | Update profile (name, phone, timezone, avatar) |

### Standard Error Response

```json
{
  "error": {
    "code": "ERR_INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "fields": {
      "password": "incorrect"
    }
  }
}
```

### Error Code Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_VALIDATION` | 422 | Input validation failed; `fields` populated |
| `ERR_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ERR_EMAIL_UNVERIFIED` | 403 | Email not yet verified |
| `ERR_USER_SUSPENDED` | 403 | Account suspended |
| `ERR_TOKEN_EXPIRED` | 401 | JWT or reset/verify token expired |
| `ERR_TOKEN_INVALID` | 401 | Token not found, already used, or blacklisted |
| `ERR_TOTP_INVALID` | 401 | Wrong TOTP code |
| `ERR_RATE_LIMITED` | 429 | Too many attempts; `retry_after` in response |
| `ERR_EMAIL_TAKEN` | 409 | Email already registered |

---

## 9. Middleware Chain

### Go Fiber Middleware Order

```
Request
  │
  ├── Caddy (TLS termination, LB)
  │
  ├── RequestID middleware         // attach X-Request-ID to every request
  ├── Logger middleware            // structured JSON log with request_id
  ├── Recover middleware           // catch panics, return 500
  ├── CORS middleware              // configured per environment
  │
  ├── [Public routes]             // /auth/register, /auth/login, /auth/refresh, etc.
  │     └── RateLimit middleware  // per-endpoint rate limiting
  │
  └── [Protected routes]          // all other /api/v1/* routes
        ├── RequireAuth middleware // validate JWT, check blacklist, set ctx.Locals("user")
        ├── RequireRole(...)       // check role claim (used per-route)
        └── RequireOrgMember(...)  // validate org_id claim matches URL org (B2B routes)
```

### `RequireAuth` Middleware Detail

```go
func RequireAuth(jwtSvc JWTService, redisSvc RedisService) fiber.Handler {
    return func(c *fiber.Ctx) error {
        // 1. Read from httpOnly cookie
        token := c.Cookies("access_token")
        if token == "" {
            return c.Status(401).JSON(ErrNoToken)
        }

        // 2. Parse and verify signature
        claims, err := jwtSvc.Validate(token)
        if err != nil {
            return c.Status(401).JSON(ErrTokenInvalid)
        }

        // 3. Check expiry
        if claims.ExpiresAt.Before(time.Now()) {
            return c.Status(401).JSON(ErrTokenExpired)
        }

        // 4. Check blacklist (logout revocation)
        if redisSvc.Exists(ctx, "blacklist:"+claims.JTI) {
            return c.Status(401).JSON(ErrTokenRevoked)
        }

        // 5. Check user active (Redis cache, 5 min TTL)
        if !redisSvc.IsUserActive(ctx, claims.Sub) {
            return c.Status(403).JSON(ErrUserSuspended)
        }

        // 6. Attach claims to context
        c.Locals("user", claims)
        return c.Next()
    }
}
```

### Next.js Edge Middleware

```typescript
// middleware.ts
import { jwtDecode } from "jose"; // lightweight, Edge-compatible

const PROTECTED_PREFIXES = ["/dashboard", "/app", "/admin", "/exam"];
const AUTH_PAGES = ["/login", "/register", "/verify-email", "/reset-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  const isAuthPage  = AUTH_PAGES.some(p => pathname.startsWith(p));

  const accessToken  = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // ── No access token ──────────────────────────────────────────────────
  if (!accessToken) {
    if (isProtected) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  // ── Decode (no verify — we trust our own server) ──────────────────────
  const claims = jwtDecode(accessToken);
  const now    = Math.floor(Date.now() / 1000);

  // ── Already logged in, redirect away from auth pages ─────────────────
  if (isAuthPage && claims.exp! > now) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Token expired or near expiry (< 2 min) ───────────────────────────
  if (claims.exp! < now + 120 && refreshToken) {
    const response = await fetch(`${process.env.API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });

    if (response.ok) {
      // Forward new cookies from refresh response to the original response
      const next = NextResponse.next();
      response.headers.getSetCookie().forEach(cookie => {
        next.headers.append("Set-Cookie", cookie);
      });
      return next;
    } else {
      // Refresh failed: force re-login
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      redirect.cookies.delete("access_token");
      redirect.cookies.delete("refresh_token");
      return redirect;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1/auth).*)"],
};
```

---

## 10. Go Module Structure

```
internal/modules/auth/
│
├── domain/                         Pure Go structs and errors. Zero external deps.
│   ├── entity.go                   User, Credential, OAuthAccount, Session, Token structs
│   ├── error.go                    ErrInvalidCredentials, ErrEmailUnverified, ErrUserSuspended,
│   │                               ErrTokenExpired, ErrTokenInvalid, ErrRateLimited, ...
│   └── token.go                    AccessToken, RefreshToken, Claims structs
│
├── port/                           Interfaces only — the module boundary
│   ├── repository.go               UserRepo, CredentialRepo, OAuthRepo,
│   │                               TokenRepo, SessionRepo interfaces
│   └── service.go                  JWTService, EmailService, TOTPService,
│                                   OAuthService, CryptoService interfaces
│
├── action/                        Business logic. Depends ONLY on port interfaces.
│   ├── register.go                 Validate → rate check → hash → insert → gen token → email
│   ├── verify_email.go             Hash token → select → validate → mark verified → consume
│   ├── login.go                    Validate creds → guards → check 2FA → issue tokens
│   ├── refresh_token.go            Validate refresh → rotate → issue new tokens
│   ├── logout.go                   Del session → blacklist access token jti
│   ├── oauth.go                    Exchange code → get user info → find/create user → issue tokens
│   ├── password_reset.go           ForgotPassword + ResetPassword; includes session invalidation
│   └── totp.go                     SetupTOTP, EnableTOTP, VerifyChallenge, Disable, UseBackupCode
│
├── adapter/
│   ├── handler/
│   │   ├── auth_handler.go         Fiber HTTP handlers. Thin: parse DTO → call action → respond.
│   │   ├── routes.go               Route registration with middleware chain per route
│   │   └── dto.go                  Request/Response structs with JSON + validator tags
│   │
│   ├── repository/
│   │   ├── pg_user_repo.go         UserRepo: FindByEmail, Insert, UpdateStatus, UpdateVerified
│   │   ├── pg_credential_repo.go   CredentialRepo: FindByUserID, UpdatePasswordHash, SetTOTP, GetTOTPSecret
│   │   ├── pg_oauth_repo.go        OAuthRepo: FindByProvider, Insert, UpdateLastSeen
│   │   ├── pg_token_repo.go        TokenRepo: InsertVerification, FindVerification, ConsumeToken
│   │   └── redis_session_repo.go   SessionRepo: Set, Get, Delete, DeleteAll (all sessions)
│   │
│   └── service/
│       ├── jwt_service.go          Sign(claims) → JWT; Validate(token) → claims. RS256 keys from env.
│       ├── totp_service.go         GenSecret, QRCodeURL, Validate(code, secret). pquerna/otp.
│       ├── oauth_service.go        Google OAuth2 client. AuthURL, Exchange, UserInfo. golang.org/x/oauth2.
│       ├── email_service.go        Resend adapter. SendVerification(to, rawToken), SendReset(to, rawToken).
│       └── crypto_service.go       GenToken() []byte, Hash(token) string, Encrypt/Decrypt AES-256-GCM.
│
└── middleware/                     Exported to other modules. Only things other modules import from auth.
    ├── auth_middleware.go          RequireAuth: read cookie → parse → check blacklist → ctx.Locals("user")
    ├── rate_limit.go               RateLimit(keyFn, max, window): Redis sliding-window, 429 on breach
    └── require_role.go             RequireRole(roles ...string): checks ctx.Locals("user").Role
```

### Module Boundary Rule

```
✅ Other modules MAY import:
   - auth/middleware (RequireAuth, RequireRole, RequireOrgMember)
   - auth/domain (Claims struct, User entity)

❌ Other modules MUST NOT import:
   - auth/action (business logic belongs to auth)
   - auth/adapter/repository (data access belongs to auth)
   - auth/adapter/service (services belong to auth)
```

### Key Go Dependencies

```go
// go.mod (auth module deps)
require (
    github.com/gofiber/fiber/v2     v2.52.x   // HTTP framework
    github.com/golang-jwt/jwt/v5    v5.x.x    // JWT RS256
    github.com/pquerna/otp          v1.4.x    // TOTP (RFC 6238)
    golang.org/x/crypto             v0.x.x    // bcrypt
    golang.org/x/oauth2             v0.x.x    // Google OAuth2
    github.com/go-playground/validator/v10 v10.x.x // Input validation
    github.com/jackc/pgx/v5         v5.x.x    // PostgreSQL driver (sqlc generated)
    github.com/redis/go-redis/v9    v9.x.x    // Redis client
    github.com/resendlabs/resend-go v1.x.x    // Email (Resend API)
)
```

---

## 11. Next.js Auth Structure

```
app/
├── (auth)/                         Auth route group — no nav, centered layout
│   ├── layout.tsx                  Minimal layout: centered card, no sidebar
│   ├── login/
│   │   └── page.tsx                Server Component; LoginForm is Client Component
│   ├── register/
│   │   └── page.tsx
│   ├── verify-email/
│   │   └── page.tsx                Server Component: calls Go verify API on page load
│   ├── check-email/
│   │   └── page.tsx                Static message: "Check your inbox"
│   ├── forgot-password/
│   │   └── page.tsx
│   ├── reset-password/
│   │   └── page.tsx
│   └── 2fa-challenge/
│       └── page.tsx                Client Component: TOTP 6-digit input
│
├── _actions/
│   └── auth.ts                     All auth Server Actions. No client-side fetch.
│                                   login(), register(), logout(), forgotPassword(),
│                                   resetPassword(), verifyEmail(), setup2FA(), enable2FA()
│
middleware.ts                       Edge Middleware: JWT decode → expiry → silent refresh → protect
│
lib/
├── auth/
│   ├── session.ts                  getSession(): reads access_token cookie in RSC/Server Actions
│   │                               Returns null if no valid session
│   ├── jwt.ts                      decodeJWT(): lightweight decode (no verify) for Edge Runtime
│   └── api-client.ts               Typed fetch wrapper; baseURL from env; credentials:'include'
│
└── types/
    └── auth.ts                     Generated from OpenAPI spec via openapi-typescript:
                                    User, TokenClaims, LoginRequest, RegisterRequest, ...
```

### Server Action Pattern

```typescript
// app/_actions/auth.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const payload = {
    email:    formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Validate with Zod before hitting API
  const parsed = LoginSchema.safeParse(payload);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const response = await fetch(`${process.env.API_URL}/api/v1/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(parsed.data),
    // credentials not needed server-to-server; Go sets Set-Cookie in response
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error.message };
  }

  // Forward Set-Cookie headers from Go to the browser
  response.headers.getSetCookie().forEach(cookie => {
    // Parse and forward via Next.js cookies() API
    cookies().set(parseCookieString(cookie));
  });

  const data = await response.json();
  if (data.requires_2fa) redirect("/auth/2fa-challenge");

  redirect("/dashboard");
}
```

### Reading Session in Server Components

```typescript
// lib/auth/session.ts
import { cookies } from "next/headers";
import { jwtDecode } from "jose";
import type { TokenClaims } from "@/lib/types/auth";

export function getSession(): TokenClaims | null {
  const token = cookies().get("access_token")?.value;
  if (!token) return null;

  try {
    const claims = jwtDecode<TokenClaims>(token);
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

// Usage in any Server Component or Server Action:
// const session = getSession();
// if (!session) redirect("/login");
// const orgId = session.org_id;
```

---

## 12. Security Design Decisions

### 1. JWT + Redis Refresh Token (not session-only)

**Decision:** Access token is a 15-minute JWT; refresh token is an opaque 7-day token stored in Redis.

**Why:** JWT is stateless — auth middleware validates it without a database hit on every request. Redis refresh token enables instant revocation (logout, suspend, password reset) that pure JWT cannot do without a blacklist. The combination gives us performance on the fast path and control on the security path.

---

### 2. httpOnly Cookies, Not `Authorization` Header

**Decision:** Both tokens stored in httpOnly, Secure, SameSite=Strict cookies. No token ever in localStorage, sessionStorage, or accessible to JavaScript.

**Why:** httpOnly cookies are completely inaccessible to JavaScript. An XSS vulnerability — even a severe one — cannot exfiltrate auth tokens. SameSite=Strict prevents cross-site request forgery. This is a structural guarantee, not a hope.

---

### 3. Narrow Cookie Paths per Token

**Decision:** `access_token: path=/api`. `refresh_token: path=/api/v1/auth/refresh`. `2fa_pending: path=/api/v1/auth/2fa`.

**Why:** The browser only sends a cookie to URLs that match its `path` attribute. The refresh_token cookie is never sent to general API endpoints — even if an attacker finds a way to read responses from those endpoints, the refresh token is never there. The 2fa_pending token literally cannot reach any other endpoint.

---

### 4. Refresh Token Rotation

**Decision:** Every refresh generates a new refresh token and immediately invalidates the old one.

**Why:** Stolen refresh tokens become self-detecting. When an attacker uses a stolen token, the legitimate user's next refresh fails (old token is gone from Redis), forcing re-login and revealing the breach. Without rotation, a stolen refresh token is silent and valid for 7 days.

---

### 5. JWT Blacklist for Immediate Logout

**Decision:** On logout, `SET blacklist:{jti} "1" EX {remaining_seconds}`. Auth middleware checks this on every authenticated request.

**Why:** Without blacklisting, logging out only clears the browser cookie — the JWT itself remains cryptographically valid for up to 15 minutes. Anyone who captured the token (network sniff, server log, etc.) could still use it. The blacklist makes logout immediate and absolute.

---

### 6. All Sensitive Tokens Stored as SHA-256 Hashes

**Decision:** Email verification, password reset, and refresh tokens are stored as `SHA-256(raw_token)` in DB/Redis. The raw token only exists in the email link or cookie.

**Why:** If the database is compromised, an attacker cannot use the stored values — they're hashes of secrets they don't have. The raw token exists exactly once: it is generated, sent immediately (via email or cookie), and never persisted anywhere. This is the same principle as password hashing, applied to all sensitive tokens.

---

### 7. bcrypt Cost Factor 12 (Intentionally Slow)

**Decision:** `bcrypt.GenerateFromPassword(password, 12)` — approximately 300ms per hash operation.

**Why:** Makes brute-forcing a stolen password hash list computationally prohibitive. The same 300ms delay is applied even when a user is not found (timing attack prevention). An attacker with a fast GPU and a compromised hash list would need years to crack strong passwords at this cost factor.

---

### 8. Anti-Enumeration on All Auth Endpoints

**Decision:** Password reset always returns HTTP 200. Login with an unknown email returns the same error message and the same response time as a wrong password.

**Why:** Without this, an attacker can enumerate valid email addresses: send reset requests to 10,000 emails, see which ones return errors, build a targeted attack list. The platform should reveal as little information as possible about which emails are registered.

---

### 9. TOTP Secrets Encrypted at Rest (AES-256-GCM)

**Decision:** TOTP secrets stored as AES-256-GCM ciphertext in DB. Encryption key loaded from environment variable (never stored in DB).

**Why:** A database compromise alone is insufficient to extract TOTP secrets. The attacker needs both the DB contents and the application encryption key, which is stored separately in the infrastructure secrets vault. Defense in depth: two separate systems must both be compromised.

---

### 10. 2FA Pending Token Pattern (Prevents Session Fixation)

**Decision:** After password validation for 2FA accounts: issue a narrow, 5-minute, single-use pending token before issuing real tokens. Full access/refresh tokens only materialize after successful TOTP validation.

**Why:** Without this, a successful password check alone creates a state that could be exploited. With the pending token, an attacker who captures the post-password state has a token that can only reach one endpoint, expires in 5 minutes, and is useless without the TOTP code. The pending token itself provides no resource access.

---

### 11. OAuth State Parameter (CSRF Protection)

**Decision:** Generate cryptographic random state nonce, store in Redis (5 min TTL), validate on OAuth callback. Return 400 if state not found.

**Why:** Prevents OAuth CSRF attacks where an attacker constructs a malicious OAuth callback URL and tricks a victim into opening it, linking the victim's account to the attacker's Google identity. The state parameter ties the callback to the specific browser session that initiated the OAuth flow — a callback with a mismatched or missing state is rejected outright.

---

### 12. TOTP Backup Codes Treated as Passwords

**Decision:** 8 backup codes generated at TOTP setup. Each stored as a bcrypt hash. Shown to user exactly once. Regenerating codes invalidates all previous codes.

**Why:** Backup codes are a second-factor replacement — they must be protected with the same rigor as passwords. bcrypt hashing means a database compromise does not expose backup codes. Users are responsible for storing them securely (printed, password manager). If lost, recovery requires account ownership verification through a separate support process.

---

*Auth Module Architecture — v1.0.0 · Go + Next.js + PostgreSQL + Redis*
