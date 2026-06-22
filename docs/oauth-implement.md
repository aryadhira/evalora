# Google OAuth Implementation Plan

## 1. Current State

### Backend — fully implemented, one gap

| What | File | Status |
|------|------|--------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in config | `config/config.go` | ✅ Done |
| `GET /auth/google` + `GET /auth/google/callback` routes | `internal/router/router.go` | ✅ Done |
| `GoogleOAuth` handler — generates state, sets cookie, redirects to Google | `internal/handler/auth_handler.go` | ✅ Done |
| `GoogleOAuthCallback` handler — validates state, exchanges code | `internal/handler/auth_handler.go` | ⚠️ Returns JSON instead of redirecting to frontend |
| `GoogleOAuthURL` / `GoogleOAuthCallback` service methods | `internal/service/auth_svc.go` | ✅ Done |
| `fetchGoogleUserInfo` from Google userinfo endpoint | `internal/service/oauth_helper.go` | ✅ Done |
| `FindOAuthAccount` / `CreateOAuthAccount` repo methods | `internal/repository/auth_repository.go` | ✅ Done |
| `OAuthAccounts` model | `internal/models/oauth.go` | ✅ Done |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env values | `backend/.env` | ❌ Empty |

### Frontend — buttons exist but are dead

| What | File | Status |
|------|------|--------|
| "Continue with Google" button | `app/(auth)/login/page.tsx`, `register/page.tsx` | ❌ No onClick / href |
| OAuth callback landing page | missing | ❌ Not created |
| `googleOAuthCallbackAction` server action | `app/_actions/auth.ts` | ❌ Not created |
| `/auth/google/callback` in proxy PUBLIC_PATHS | `proxy.ts` | ❌ Missing |
| `NEXT_PUBLIC_API_URL` env var | `frontend/.env.local` | ❌ Missing |

---

## 2. Gaps

### Backend (1 gap)

`GoogleOAuthCallback` handler currently returns JSON:
```go
return c.JSON(fiber.Map{"access_token": tokens.AccessToken, "expires_in": tokens.ExpiresIn})
```
It must redirect to the frontend callback page with tokens as query params instead.

### Frontend (4 gaps)

1. Google buttons have no navigation — clicking does nothing
2. No `/auth/google/callback` page to receive the redirect from Go
3. No `googleOAuthCallbackAction` server action to store cookies
4. `/auth/google/callback` not in `PUBLIC_PATHS` → proxy blocks it

---

## 3. Implementation Steps

### Step 1 — Google Cloud Console setup

1. Go to https://console.cloud.google.com → **APIs & Services > Credentials**
2. **Create Credentials > OAuth client ID** → Web application
3. **Authorized redirect URIs**: `http://localhost:9898/auth/google/callback`
4. Enable **Google People API** (needed for `/oauth2/v2/userinfo`)
5. Copy **Client ID** and **Client Secret**

---

### Step 2 — Set environment variables

**`backend/.env`** — fill in the values from Step 1:
```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
APP_URL=http://localhost:9898        # controls redirect URI sent to Google
APP_FRONTEND_URL=http://localhost:3000
```

**`frontend/.env.local`** — add:
```
NEXT_PUBLIC_API_URL=http://localhost:9898
```
The `NEXT_PUBLIC_` prefix is required so client components can read it.

---

### Step 3 — Fix backend callback handler to redirect instead of returning JSON

**File:** `internal/service/auth_svc.go`

Add `FrontendURL() string` to the `AuthService` interface and implement it:
```go
// in interface
FrontendURL() string

// implementation
func (s *authService) FrontendURL() string { return s.cfg.AppFrontendURL }
```

**File:** `internal/handler/auth_handler.go`

Replace the JSON response in `GoogleOAuthCallback` with a redirect that passes both tokens as query params:
```go
// Remove: setRefreshCookie + c.JSON(...)
// Add:
redirectURL := fmt.Sprintf(
    "%s/auth/google/callback?access_token=%s&refresh_token=%s&expires_in=%d",
    h.authSvc.FrontendURL(),
    url.QueryEscape(tokens.AccessToken),
    url.QueryEscape(tokens.RefreshToken),
    tokens.ExpiresIn,
)
return c.Redirect().To(redirectURL)
```

> **Why query params?** The Go backend runs on port 9898, Next.js on 3000 — different origins. Cookies set by Go cannot be read by Next.js. Passing tokens in the URL lets the Next.js server action pick them up and store them as its own httpOnly cookies.

Add imports: `"fmt"` and `"net/url"`.

---

### Step 4 — Add server action for OAuth callback

**File:** `frontend/app/_actions/auth.ts`

```ts
export async function googleOAuthCallbackAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const accessToken = formData.get("access_token") as string
  const refreshToken = formData.get("refresh_token") as string
  if (!accessToken || !refreshToken) return { error: "OAuth authentication failed" }
  await setAuthCookies(accessToken, refreshToken)
  redirect("/dashboard")
}
```

---

### Step 5 — Create the frontend OAuth callback page

**File to create:** `frontend/app/auth/google/callback/page.tsx`

This page sits outside the `(auth)` route group (so it doesn't inherit the split-panel layout) and handles the redirect from the Go backend.

```tsx
"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { googleOAuthCallbackAction } from "@/app/_actions/auth"
import { Loader2 } from "lucide-react"

function OAuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const accessToken = searchParams.get("access_token")
    const refreshToken = searchParams.get("refresh_token")

    if (!accessToken || !refreshToken) {
      router.replace("/login?error=oauth_failed")
      return
    }

    const formData = new FormData()
    formData.set("access_token", accessToken)
    formData.set("refresh_token", refreshToken)
    googleOAuthCallbackAction(null, formData)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 size={28} className="animate-spin text-[#2563EB]" />
      <p className="text-sm text-[#64748B]">Completing sign in…</p>
    </div>
  )
}

export default function OAuthCallbackPage() {
  return <Suspense><OAuthCallbackContent /></Suspense>
}
```

---

### Step 6 — Update the proxy

**File:** `frontend/proxy.ts`

Add `/auth/google/callback` to both `PUBLIC_PATHS` and `ALWAYS_ALLOW`:
```ts
const PUBLIC_PATHS = [...existing..., "/auth/google/callback"]
const ALWAYS_ALLOW = ["/verify-email", "/reset-password", "/auth/google/callback"]
```

---

### Step 7 — Wire the Google buttons

**Files:** `app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx`

Replace the `<button type="button">` with an `<a>` tag:
```tsx
<a
  href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
  className="flex w-full h-11 items-center justify-center gap-3 rounded-[10px] border border-[#E2E8F0] bg-white text-[14px] font-medium text-[#374151] shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:border-[#CBD5E1] active:translate-y-px"
>
  <GoogleIcon />
  Continue with Google
</a>
```

---

## 4. Full OAuth Flow

```
1. USER clicks "Continue with Google"
   → browser navigates to GET http://localhost:9898/auth/google

2. BACKEND GoogleOAuth handler
   → generates random state token
   → sets oauth_state cookie (HTTPOnly, SameSite=Lax, 10min) on port 9898
   → 302 redirect → accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=http://localhost:9898/auth/google/callback&state=...

3. BROWSER at Google
   → user signs in / grants consent

4. GOOGLE redirects back
   → GET http://localhost:9898/auth/google/callback?code=<code>&state=<state>
   → browser sends oauth_state cookie (SameSite=Lax allows on top-level GET redirect)

5. BACKEND GoogleOAuthCallback handler
   → validates state == oauth_state cookie (CSRF check)
   → calls service.GoogleOAuthCallback(code)

6. BACKEND service
   → exchanges code for Google tokens via oauth2.Exchange
   → GET googleapis.com/oauth2/v2/userinfo → {id, email, name, picture}
   → FindOAuthAccount("google", id):
       found   → use existing userID
       not found → FindByEmail or create new user (EmailVerified=true) + CreateOAuthAccount
   → issueTokens(userID) → JWT access token + refresh token + UserSession in DB

7. BACKEND redirects to frontend (after Step 3 fix)
   → 302 → http://localhost:3000/auth/google/callback
               ?access_token=<jwt>&refresh_token=<token>&expires_in=900

8. FRONTEND proxy
   → /auth/google/callback is in PUBLIC_PATHS + ALWAYS_ALLOW → passes through

9. FRONTEND callback page
   → reads access_token + refresh_token from URL
   → calls googleOAuthCallbackAction(formData)

10. SERVER ACTION
    → setAuthCookies(accessToken, refreshToken)
      → sets evalora_at (15min) + evalora_rt (7d) as HTTPOnly cookies on port 3000
    → redirect("/dashboard")

11. USER is authenticated on /dashboard
```

---

## 5. Files Changed Summary

| File | Change |
|------|--------|
| `backend/.env` | Fill `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| `backend/internal/service/auth_svc.go` | Add `FrontendURL()` to interface + impl |
| `backend/internal/handler/auth_handler.go` | Replace JSON response with redirect in `GoogleOAuthCallback` |
| `frontend/.env.local` | Add `NEXT_PUBLIC_API_URL` |
| `frontend/proxy.ts` | Add `/auth/google/callback` to `PUBLIC_PATHS` + `ALWAYS_ALLOW` |
| `frontend/app/_actions/auth.ts` | Add `googleOAuthCallbackAction` |
| `frontend/app/auth/google/callback/page.tsx` | Create callback page |
| `frontend/app/(auth)/login/page.tsx` | Replace `<button>` with `<a href>` |
| `frontend/app/(auth)/register/page.tsx` | Replace `<button>` with `<a href>` |
