"use client"

import { Suspense, useActionState, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { resetPasswordAction } from "@/app/_actions/auth"
import { Eye, EyeOff, Loader2, XCircle } from "lucide-react"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [state, action, isPending] = useActionState(resetPasswordAction, null)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-200">
            <XCircle size={28} className="text-[#EF4444]" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Invalid link</h2>
          <p className="text-[14.5px] text-[#64748B]">This reset link is missing a token. Please request a new one.</p>
        </div>
        <Link href="/forgot-password">
          <Button className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] border-0">
            Request new link
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Set new password</h2>
        <p className="text-[14.5px] text-[#64748B]">Choose a strong password for your account</p>
      </div>

      <form action={action} className="space-y-[15px]">
        <input type="hidden" name="token" value={token} />

        {state?.error && (
          <div className="rounded-[10px] bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-[#EF4444]">
            {state.error}
          </div>
        )}

        <div>
          <Label htmlFor="new_password">New password</Label>
          <div className="relative">
            <Input id="new_password" name="new_password" type={showNew ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" aria-invalid={!!state?.errors?.new_password} className="pr-10" />
            <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors" tabIndex={-1}>
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {state?.errors?.new_password
            ? <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.new_password}</p>
            : <p className="mt-1.5 text-[12.5px] text-[#64748B]">Minimum 8 characters</p>
          }
        </div>

        <div>
          <Label htmlFor="confirm_password">Confirm new password</Label>
          <div className="relative">
            <Input id="confirm_password" name="confirm_password" type={showConfirm ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" aria-invalid={!!state?.errors?.confirm_password} className="pr-10" />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors" tabIndex={-1}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {state?.errors?.confirm_password && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.confirm_password}</p>}
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] border-0 shadow-[0_1px_4px_rgba(37,99,235,0.3)] transition-all active:translate-y-px">
          {isPending && <Loader2 size={16} className="animate-spin mr-2" />}
          {isPending ? "Saving…" : "Set new password"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-[#64748B]">
        <Link href="/login" className="text-[#2563EB] font-medium hover:text-[#1D4ED8] transition-colors">← Back to sign in</Link>
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordContent /></Suspense>
}
