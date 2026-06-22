import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/check-email", "/2fa-challenge", "/auth/google/callback"]
// These public paths must always be reachable regardless of auth state (they carry a token in the URL)
const ALWAYS_ALLOW = ["/verify-email", "/reset-password", "/auth/google/callback"]

const secret = new TextEncoder().encode(process.env.APP_SECRET ?? "")

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Redirect legacy /auth/* email links (old backend format) to the correct routes
  if (pathname.startsWith("/auth/verify-email")) {
    return NextResponse.redirect(new URL(`/verify-email${search}`, request.url))
  }
  if (pathname.startsWith("/auth/reset-password")) {
    return NextResponse.redirect(new URL(`/reset-password${search}`, request.url))
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  const accessToken = request.cookies.get("evalora_at")?.value
  const refreshToken = request.cookies.get("evalora_rt")?.value

  let isValid = false

  if (accessToken) {
    try {
      await jwtVerify(accessToken, secret)
      isValid = true
    } catch {}
  }

  // Try refresh if access token invalid but refresh token exists
  if (!isValid && refreshToken) {
    try {
      const apiUrl = process.env.API_URL ?? "http://localhost:9898"
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `refresh_token=${refreshToken}` },
        cache: "no-store",
      })

      if (res.ok) {
        const data = await res.json()
        const newAccessToken: string = data.access_token
        const newRefreshRaw = res.headers.getSetCookie?.().find((c) => c.startsWith("refresh_token="))
        const newRefreshToken = newRefreshRaw?.split(";")[0]?.split("=").slice(1).join("=")

        const shouldRedirect = isPublic && !ALWAYS_ALLOW.some((p) => pathname.startsWith(p))
        const response = shouldRedirect
          ? NextResponse.redirect(new URL("/dashboard", request.url))
          : NextResponse.next()

        response.cookies.set("evalora_at", newAccessToken, { httpOnly: true, sameSite: "lax", maxAge: 15 * 60, path: "/" })
        if (newRefreshToken) {
          response.cookies.set("evalora_rt", newRefreshToken, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60, path: "/" })
        }
        return response
      }
    } catch {}
  }

  if (!isValid && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isValid && isPublic && !ALWAYS_ALLOW.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
