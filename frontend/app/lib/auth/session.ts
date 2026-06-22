import { cookies } from "next/headers"

const ACCESS_TOKEN_COOKIE = "evalora_at"
const REFRESH_TOKEN_COOKIE = "evalora_rt"

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const store = await cookies()
  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
  })
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  })
}

export async function clearAuthCookies() {
  const store = await cookies()
  store.delete(ACCESS_TOKEN_COOKIE)
  store.delete(REFRESH_TOKEN_COOKIE)
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(ACCESS_TOKEN_COOKIE)?.value
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(REFRESH_TOKEN_COOKIE)?.value
}

export function extractRefreshTokenFromSetCookie(headers: Headers): string | null {
  const setCookies = headers.getSetCookie?.() ?? []
  const raw = setCookies.find((c) => c.startsWith("refresh_token="))
  if (!raw) return null
  return raw.split(";")[0].split("=").slice(1).join("=")
}
