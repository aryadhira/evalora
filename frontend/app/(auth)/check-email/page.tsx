"use client"

import { Suspense, useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { resendVerificationAction } from "@/app/_actions/auth"
import { Mail, Loader2 } from "lucide-react"

function CheckEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") ?? ""
  const [state, action, isPending] = useActionState(resendVerificationAction, null)
  const sent = (state?.data as any)?.sent

  return (
    <div className="space-y-7">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE]">
          <Mail size={28} className="text-[#2563EB]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Check your email</h2>
          <p className="text-[14.5px] text-[#64748B] leading-relaxed">We&apos;ve sent a verification link to</p>
          {email && (
            <p className="inline-block px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[13.5px] font-mono text-[#374151]">
              {email}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-4 space-y-1.5">
        <p className="text-[13px] font-medium text-[#374151]">Next steps</p>
        <ol className="space-y-1 text-[13px] text-[#64748B] list-decimal list-inside">
          <li>Open the email from Evalora</li>
          <li>Click &quot;Verify Email&quot; button</li>
          <li>Return here to sign in</li>
        </ol>
      </div>

      {sent && (
        <div className="rounded-[10px] bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] text-emerald-700">
          ✓ Verification email resent successfully.
        </div>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <p className="text-[13px] text-[#64748B] text-center">Didn&apos;t receive the email?</p>
        <Button type="submit" disabled={isPending} variant="outline" className="w-full h-11 rounded-[10px] border-[#E2E8F0] text-[#374151] font-medium text-[14px] hover:bg-[#F8FAFC] transition-all">
          {isPending && <Loader2 size={16} className="animate-spin mr-2" />}
          {isPending ? "Resending…" : "Resend verification email"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-[#64748B]">
        <Link href="/login" className="text-[#2563EB] font-medium hover:text-[#1D4ED8] transition-colors">← Back to sign in</Link>
      </p>
    </div>
  )
}

export default function CheckEmailPage() {
  return <Suspense><CheckEmailContent /></Suspense>
}
