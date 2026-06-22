"use client"

import { Suspense, useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { loginAction } from "@/app/_actions/auth"
import { Eye, EyeOff, Loader2 } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, action, isPending] = useActionState(loginAction, null)
  const [showPassword, setShowPassword] = useState(false)

  const verified = searchParams.get("verified")
  const reset = searchParams.get("reset")

  useEffect(() => {
    if (state?.data && (state.data as any).requires2fa) {
      const token = (state.data as any).pending_token
      router.push(`/2fa-challenge?pending_token=${encodeURIComponent(token)}`)
    }
  }, [state, router])

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Welcome back</h2>
        <p className="text-[14.5px] text-[#64748B]">Sign in to your Evalora account</p>
      </div>

      {verified && (
        <div className="rounded-[10px] bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] text-emerald-700">
          ✓ Email verified successfully. You can now sign in.
        </div>
      )}
      {reset && (
        <div className="rounded-[10px] bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] text-emerald-700">
          ✓ Password reset successfully. Sign in with your new password.
        </div>
      )}

      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
        className="flex w-full h-11 items-center justify-center gap-3 rounded-[10px] border border-[#E2E8F0] bg-white text-[14px] font-medium text-[#374151] shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:border-[#CBD5E1] active:translate-y-px"
      >
        <GoogleIcon />
        Continue with Google
      </a>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#F1F5F9]" />
        <span className="text-[12px] text-[#94A3B8]">or sign in with email</span>
        <div className="flex-1 h-px bg-[#F1F5F9]" />
      </div>

      <form action={action} className="space-y-[15px]">
        {state?.error && (
          <div className="rounded-[10px] bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-[#EF4444]">
            {state.error}
          </div>
        )}

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!state?.errors?.email} />
          {state?.errors?.email && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.email}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="password" className="mb-0">Password</Label>
            <Link href="/forgot-password" className="text-[12.5px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" aria-invalid={!!state?.errors?.password} className="pr-10" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors" tabIndex={-1}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {state?.errors?.password && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.password}</p>}
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] border-0 shadow-[0_1px_4px_rgba(37,99,235,0.3)] transition-all active:translate-y-px">
          {isPending && <Loader2 size={16} className="animate-spin mr-2" />}
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-[#64748B]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#2563EB] font-medium hover:text-[#1D4ED8] transition-colors">Create account</Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
