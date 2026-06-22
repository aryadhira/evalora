# 2FA Setup & Management Implementation Plan

## 1. Current State

### Backend — Fully Implemented

All backend code for 2FA setup and management is complete. Every service method, handler, and route already exists.

**Service methods** (`backend/internal/service/auth_svc.go`):

| Method | What it does |
|--------|-------------|
| `SetupTOTP(userID)` | Generates TOTP key (Issuer: "Evalora"), returns `secret` + `otp_url`. Does NOT persist — only happens on Enable. |
| `EnableTOTP(userID, secret, totpCode)` | Validates code, hashes 8 backup codes, persists `TOTPSecret`, sets `TOTPEnabled = true`. Returns plaintext backup codes. |
| `ChallengeTOTP(...)` | Already done — used at login with `pending_token`. |
| `DisableTOTP(userID, password)` | Verifies password via bcrypt, clears `TOTPEnabled`, `TOTPSecret`, `TOTPBackupCodes`. |
| `RegenerateTOTPBackup(userID, totpCode)` | Validates live TOTP code, generates 8 new backup codes, replaces stored hashes. Returns plaintext codes. |

**Handlers** (`backend/internal/handler/auth_handler.go`):

| Handler | Route |
|---------|-------|
| `TOTPSetup` | `GET /auth/2fa/setup` (jwtAuth) |
| `TOTPEnable` | `POST /auth/2fa/enable` (jwtAuth) |
| `TOTPChallenge` | `POST /auth/2fa/challenge` (public, already used) |
| `TOTPDisable` | `POST /auth/2fa/disable` (jwtAuth) |
| `TOTPRegenerateBackup` | `POST /auth/2fa/backup/regenerate` (jwtAuth) |

**Model** (`backend/internal/models/user.go`): `UserCredential` has `TOTPSecret` (text), `TOTPEnabled` (bool, default false), `TOTPBackupCodes` (text, JSON array of hashed codes).

**One gap**: No `GET /auth/2fa/status` endpoint. The frontend cannot know if 2FA is enabled from `GET /auth/me` alone — it only returns `Users`, not `UserCredential`.

### Frontend — Nothing Implemented for 2FA Management

- `app/_actions/auth.ts` — has `totpChallengeAction` (login) but no setup/enable/disable/backup actions
- `app/lib/auth/api-client.ts` — has `challengeTOTP` but no management methods
- `app/(dashboard)/settings/` — directory does not exist
- Sidebar has `/settings` link already wired but route doesn't exist

---

## 2. User Flow

### Enable 2FA
1. User goes to `/settings/security` — page loads TOTP status. Shows "Enable Two-Factor Authentication" button.
2. User clicks Enable → modal opens, frontend calls `GET /auth/2fa/setup`.
3. Modal shows QR code (from `otp_url`) + raw `secret` for manual entry + 6-digit code input.
4. User scans QR in authenticator app, enters code, clicks "Verify & Enable".
5. Frontend calls `POST /auth/2fa/enable` with `{ secret, totp_code }`.
6. Modal transitions to Backup Codes screen showing all 8 codes. User copies/saves them, clicks Done.

### Disable 2FA
1. On `/settings/security` with 2FA enabled → "Disable 2FA" button.
2. Modal opens asking for account password.
3. `POST /auth/2fa/disable` with `{ password }`. Settings page updates.

### Regenerate Backup Codes
1. "Regenerate backup codes" button on settings page.
2. Modal asks for current 6-digit TOTP code.
3. `POST /auth/2fa/backup/regenerate` with `{ totp_code }`. Modal shows 8 new codes.

---

## 3. Gaps

### Backend (1 gap)

**Missing: `GET /auth/2fa/status`** — expose whether 2FA is enabled and how many backup codes remain.

### Frontend (all missing)

1. `app/lib/auth/api-client.ts` — no `getTOTPStatus`, `setupTOTP`, `enableTOTP`, `disableTOTP`, `regenerateTOTPBackup`
2. `app/_actions/auth.ts` — no `getTOTPStatusAction`, `setupTOTPAction`, `enableTOTPAction`, `disableTOTPAction`, `regenerateBackupAction`
3. `app/(dashboard)/settings/` — no pages
4. 2FA modal components — all missing
5. `react-qr-code` not installed
6. Type definitions not added
7. Sidebar active state only does exact match — `/settings/security` won't highlight `/settings` nav item

---

## 4. API Contract

### `GET /auth/2fa/status`
**Headers**: `Authorization: Bearer <access_token>`
```json
// 200
{ "totp_enabled": true, "backup_codes_remaining": 6 }
```

### `GET /auth/2fa/setup`
**Headers**: `Authorization: Bearer <access_token>`
```json
// 200
{ "secret": "JBSWY3DPEHPK3PXP", "otp_url": "otpauth://totp/Evalora:user@example.com?..." }
// 409: { "error": "2FA is already enabled" }
```

### `POST /auth/2fa/enable`
**Headers**: `Authorization: Bearer <access_token>`
```json
// Body
{ "secret": "JBSWY3DPEHPK3PXP", "totp_code": "123456" }
// 200
{ "message": "2FA enabled successfully", "backup_codes": ["a1b2c3d4e5", "..."] }
// 400: invalid code, 409: already enabled
```

### `POST /auth/2fa/disable`
**Headers**: `Authorization: Bearer <access_token>`
```json
// Body
{ "password": "userCurrentPassword" }
// 200: { "message": "2FA disabled successfully" }
// 400: not enabled, 401: invalid password
```

### `POST /auth/2fa/backup/regenerate`
**Headers**: `Authorization: Bearer <access_token>`
```json
// Body
{ "totp_code": "123456" }
// 200: { "backup_codes": ["newcode1", "..."] }
// 400: not enabled, 401: invalid code
```

---

## 5. Implementation Steps

### Step 1 — Backend: Add `GET /auth/2fa/status`

**`backend/internal/service/auth_svc.go`** — add to interface:
```go
GetTOTPStatus(userID uuid.UUID) (bool, int, error)
```

Add implementation:
```go
func (s *authService) GetTOTPStatus(userID uuid.UUID) (bool, int, error) {
    cred, err := s.userRepo.FindCredentialByUserID(userID)
    if err != nil {
        return false, 0, err
    }
    remaining := 0
    if cred.TOTPEnabled && cred.TOTPBackupCodes != "" {
        var codes []string
        if json.Unmarshal([]byte(cred.TOTPBackupCodes), &codes) == nil {
            remaining = len(codes)
        }
    }
    return cred.TOTPEnabled, remaining, nil
}
```

**`backend/internal/handler/auth_handler.go`** — add handler:
```go
func (h *AuthHandler) TOTPStatus(c fiber.Ctx) error {
    userID, ok := h.userID(c)
    if !ok {
        return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
    }
    enabled, remaining, err := h.authSvc.GetTOTPStatus(userID)
    if err != nil {
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch 2FA status"})
    }
    return c.JSON(fiber.Map{
        "totp_enabled":           enabled,
        "backup_codes_remaining": remaining,
    })
}
```

**`backend/internal/router/router.go`** — register route with the other 2FA routes:
```go
auth.Get("/2fa/status", jwtAuth, authHandler.TOTPStatus)
```

---

### Step 2 — Frontend: Install QR code library

```bash
npm install react-qr-code
```

---

### Step 3 — Frontend: Add type definitions

**`frontend/app/lib/types/auth.ts`** — append:
```ts
export interface TOTPSetupResponse {
  secret: string
  otp_url: string
}

export interface TOTPEnableResponse {
  message: string
  backup_codes: string[]
}

export interface TOTPStatusResponse {
  totp_enabled: boolean
  backup_codes_remaining: number
}

export interface TOTPBackupResponse {
  backup_codes: string[]
}
```

---

### Step 4 — Frontend: Add API client methods

**`frontend/app/lib/auth/api-client.ts`** — add to `authApi`:
```ts
getTOTPStatus: (token: string) =>
  request<TOTPStatusResponse>("GET", "/auth/2fa/status", { token }),

setupTOTP: (token: string) =>
  request<TOTPSetupResponse>("GET", "/auth/2fa/setup", { token }),

enableTOTP: (token: string, body: { secret: string; totp_code: string }) =>
  request<TOTPEnableResponse>("POST", "/auth/2fa/enable", { token, body }),

disableTOTP: (token: string, body: { password: string }) =>
  request("POST", "/auth/2fa/disable", { token, body }),

regenerateTOTPBackup: (token: string, body: { totp_code: string }) =>
  request<TOTPBackupResponse>("POST", "/auth/2fa/backup/regenerate", { token, body }),
```

---

### Step 5 — Frontend: Add server actions

**`frontend/app/_actions/auth.ts`** — add (all require calling `getAccessToken()` from session.ts):

```ts
export async function getTOTPStatusAction(): Promise<TOTPStatusResponse | null>
export async function setupTOTPAction(): Promise<ActionState>
export async function enableTOTPAction(_: ActionState, formData: FormData): Promise<ActionState>
export async function disableTOTPAction(_: ActionState, formData: FormData): Promise<ActionState>
export async function regenerateBackupAction(_: ActionState, formData: FormData): Promise<ActionState>
```

---

### Step 6 — Frontend: Create Settings pages

**`app/(dashboard)/settings/page.tsx`** — redirect to `/settings/security`

**`app/(dashboard)/settings/security/page.tsx`** — Server Component:
```tsx
import { getTOTPStatusAction } from "@/app/_actions/auth"
import { SecuritySettingsClient } from "@/components/dashboard/security-settings"

export default async function SecuritySettingsPage() {
  const status = await getTOTPStatusAction()
  return <SecuritySettingsClient initialStatus={status} />
}
```

---

### Step 7 — Frontend: Create UI Components

**`components/dashboard/security-settings.tsx`** — "use client" orchestrator:
- Shows 2FA status card with enable/disable buttons
- Manages which modal is open

**`components/dashboard/2fa-setup-modal.tsx`** — "use client" multi-step:
- Step 1 "scan": QR code from `react-qr-code`, secret for manual entry, 6-digit code input, calls `enableTOTPAction`
- Step 2 "backup": 8 codes in 2-column grid, Copy all button, Done button
- Thread `secret` via hidden `<input name="secret">` into the enable form

**`components/dashboard/2fa-disable-modal.tsx`** — "use client":
- Password input, calls `disableTOTPAction`, calls `onDisabled()` on success

**`components/dashboard/2fa-regenerate-modal.tsx`** — "use client" multi-step:
- Step 1: TOTP code input, calls `regenerateBackupAction`
- Step 2: New codes grid, Done button

---

### Step 8 — Frontend: Fix sidebar active state

**`components/dashboard/sidebar.tsx`** — change exact match to prefix match for Settings:
```tsx
const active = href === "/settings"
  ? pathname.startsWith("/settings")
  : pathname === href
```

---

## 6. UI Screens

| Screen | File | What it shows |
|--------|------|---------------|
| Security settings | `app/(dashboard)/settings/security/page.tsx` | 2FA status card, enable/disable/regenerate CTAs |
| Setup modal step 1 | `components/dashboard/2fa-setup-modal.tsx` | QR code + manual secret + 6-digit code input |
| Setup modal step 2 | same file | 8 backup codes in monospace grid + copy/done |
| Disable modal | `components/dashboard/2fa-disable-modal.tsx` | Password input + destructive confirm button |
| Regenerate modal step 1 | `components/dashboard/2fa-regenerate-modal.tsx` | TOTP code input + warning |
| Regenerate modal step 2 | same file | 8 new codes grid + done button |

---

## 7. Implementation Order

1. Backend: Add `GetTOTPStatus` to service interface + implementation
2. Backend: Add `TOTPStatus` handler
3. Backend: Register `GET /auth/2fa/status` route
4. Frontend: `npm install react-qr-code`
5. Frontend: Add type definitions
6. Frontend: Add API client methods
7. Frontend: Add server actions
8. Frontend: Create `settings/page.tsx` (redirect)
9. Frontend: Create `settings/security/page.tsx` (server component)
10. Frontend: Create `security-settings.tsx` (client orchestrator)
11. Frontend: Create `2fa-setup-modal.tsx`
12. Frontend: Create `2fa-disable-modal.tsx`
13. Frontend: Create `2fa-regenerate-modal.tsx`
14. Frontend: Fix sidebar active state
