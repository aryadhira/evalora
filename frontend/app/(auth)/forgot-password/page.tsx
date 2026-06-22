"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { forgotPasswordAction } from "@/app/_actions/auth"
import { Mail, Loader2, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const [state, action, isPending] = useActionState(forgotPasswordAction, null)
  const sent = (state?.data as any)?.sent

  if (sent) {
    return (
      <div className="space-y-7">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200">
            <CheckCircle size={28} className="text-emerald-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Reset link sent!</h2>
            <p className="text-[14.5px] text-[#64748B] leading-relaxed">
              If an account with that email exists, we&apos;ve sent a password reset link. Check your inbox.
            </p>
          </div>
        </div>
        <div className="rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-4 space-y-1.5">
          <p className="text-[13px] font-medium text-[#374151]">The link expires in 1 hour</p>
          <p className="text-[13px] text-[#64748B]">If you don&apos;t see it, check your spam folder.</p>
        </div>
        <p className="text-center text-[13px] text-[#64748B]">
          <Link href="/login" className="text-[#2563EB] font-medium hover:text-[#1D4ED8] transition-colors">
            ← Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Forgot password?</h2>
        <p className="text-[14.5px] text-[#64748B] leading-relaxed">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form action={action} className="space-y-[15px]">
        {state?.error && (
          <div className="rounded-[10px] bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-[#EF4444]">
            {state.error}
          </div>
        )}

        <div>
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!state?.errors?.email}
              className="pl-10"
            />
          </div>
          {state?.errors?.email && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.email}</p>}
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] border-0 shadow-[0_1px_4px_rgba(37,99,235,0.3)] transition-all active:translate-y-px">
          {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          {isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-[#64748B]">
        <Link href="/login" className="text-[#2563EB] font-medium hover:text-[#1D4ED8] transition-colors">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}
