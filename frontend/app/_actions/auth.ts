"use server"

import { redirect } from "next/navigation"
import { authApi } from "@/app/lib/auth/api-client"
import { setAuthCookies, clearAuthCookies, extractRefreshTokenFromSetCookie } from "@/app/lib/auth/session"
import type { ActionState } from "@/app/lib/types/auth"

function validate(fields: Record<string, { value: string; label: string; min?: number }>) {
  const errors: Record<string, string> = {}
  for (const [key, { value, label, min = 1 }] of Object.entries(fields)) {
    if (!value || value.trim().length < min) {
      errors[key] = min > 1 ? `${label} must be at least ${min} characters` : `${label} is required`
    }
  }
  return errors
}

export async function loginAction(_: ActionState, formData: FormData): Promise<NonNullable<ActionState>> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const errors = validate({
    email: { value: email, label: "Email" },
    password: { value: password, label: "Password" },
  })
  if (Object.keys(errors).length) return { errors }

  const { data, error, status, headers } = await authApi.login({ email, password })
  if (error) return { error }

  // 2FA required
  if (status === 202 && (data as any)?.["2fa_required"]) {
    return { data: { pending_token: (data as any).pending_token, requires2fa: true } }
  }

  const tokens = data as { access_token: string }
  const refreshToken = extractRefreshTokenFromSetCookie(headers)
  if (refreshToken) {
    await setAuthCookies(tokens.access_token, refreshToken)
  }

  redirect("/dashboard")
}

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirm_password") as string

  const errors = validate({
    name: { value: name, label: "Full name" },
    email: { value: email, label: "Email" },
    password: { value: password, label: "Password", min: 8 },
  })
  if (confirmPassword !== password) errors.confirm_password = "Passwords do not match"
  if (Object.keys(errors).length) return { errors }

  const { error } = await authApi.register({ name, email, password })
  if (error) return { error }

  redirect(`/check-email?email=${encodeURIComponent(email)}`)
}

export async function verifyEmailAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = formData.get("token") as string
  if (!token) return { error: "Verification token is missing" }

  const { error } = await authApi.verifyEmail(token)
  if (error) return { error }

  redirect("/login?verified=1")
}

export async function resendVerificationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = formData.get("email") as string
  await authApi.resendVerification(email)
  return { data: { sent: true } }
}

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = formData.get("email") as string
  const errors = validate({ email: { value: email, label: "Email" } })
  if (Object.keys(errors).length) return { errors }

  await authApi.forgotPassword(email)
  return { data: { sent: true } }
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = formData.get("token") as string
  const new_password = formData.get("new_password") as string
  const confirm_password = formData.get("confirm_password") as string

  const errors = validate({ new_password: { value: new_password, label: "Password", min: 8 } })
  if (confirm_password !== new_password) errors.confirm_password = "Passwords do not match"
  if (Object.keys(errors).length) return { errors }

  const { error } = await authApi.resetPassword({ token, new_password })
  if (error) return { error }

  redirect("/login?reset=1")
}

export async function totpChallengeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const pending_token = formData.get("pending_token") as string
  const totp_code = formData.get("totp_code") as string

  if (!totp_code || totp_code.length < 6) return { errors: { totp_code: "Enter your 6-digit code" } }

  const { data, error, headers } = await authApi.challengeTOTP({ pending_token, totp_code })
  if (error) return { error }

  const tokens = data as { access_token: string }
  const refreshToken = extractRefreshTokenFromSetCookie(headers)
  if (refreshToken) {
    await setAuthCookies(tokens.access_token, refreshToken)
  }

  redirect("/dashboard")
}

export async function googleOAuthCallbackAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const accessToken = formData.get("access_token") as string
  const refreshToken = formData.get("refresh_token") as string
  if (!accessToken || !refreshToken) return { error: "OAuth authentication failed" }
  await setAuthCookies(accessToken, refreshToken)
  redirect("/dashboard")
}

export async function logoutAction() {
  await clearAuthCookies()
  redirect("/login")
}
