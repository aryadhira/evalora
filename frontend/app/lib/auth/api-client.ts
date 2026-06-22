const API_URL = process.env.API_URL ?? "http://localhost:9898"

type RequestOptions = {
  body?: unknown
  token?: string
  refreshToken?: string
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<{ data?: T; error?: string; status: number; headers: Headers }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`
  if (opts.refreshToken) headers["Cookie"] = `refresh_token=${opts.refreshToken}`

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  })

  let data: T | undefined
  let error: string | undefined

  try {
    const json = await res.json()
    if (!res.ok) error = json.error ?? "An unexpected error occurred"
    else data = json
  } catch {
    if (!res.ok) error = "An unexpected error occurred"
  }

  return { data, error, status: res.status, headers: res.headers }
}

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    request("POST", "/auth/register", { body }),

  login: (body: { email: string; password: string }) =>
    request("POST", "/auth/login", { body }),

  verifyEmail: (token: string) =>
    request("POST", "/auth/verify-email", { body: { token } }),

  resendVerification: (email: string) =>
    request("POST", "/auth/resend-verification", { body: { email } }),

  forgotPassword: (email: string) =>
    request("POST", "/auth/forgot-password", { body: { email } }),

  resetPassword: (body: { token: string; new_password: string }) =>
    request("POST", "/auth/reset-password", { body }),

  challengeTOTP: (body: { pending_token: string; totp_code: string }) =>
    request("POST", "/auth/2fa/challenge", { body }),

  refresh: (refreshToken: string) =>
    request("POST", "/auth/refresh", { refreshToken }),

  logout: (token: string) =>
    request("POST", "/auth/logout", { token }),
}
