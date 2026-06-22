"use client"

import { Suspense, useActionState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { verifyEmailAction } from "@/app/_actions/auth"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [state, action, isPending] = useActionState(verifyEmailAction, null)

  useEffect(() => {
    if (token && !state) {
      const form = document.getElementById("verify-form") as HTMLFormElement
      form?.requestSubmit()
    }
  }, [token, state])

  return (
    <div className="space-y-7">
      <div className="flex flex-col items-center text-center space-y-4">
        {isPending && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE]">
              <Loader2 size={28} className="text-[#2563EB] animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Verifying email</h2>
              <p className="text-[14.5px] text-[#64748B]">Please wait a moment…</p>
            </div>
          </>
        )}

        {!isPending && state?.error && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-200">
              <XCircle size={28} className="text-[#EF4444]" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Verification failed</h2>
              <p className="text-[14.5px] text-[#64748B]">{state.error}</p>
            </div>
            <div className="w-full space-y-3 pt-2">
              <Link href="/check-email">
                <Button className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] border-0">
                  Request new link
                </Button>
              </Link>
              <Link href="/login" className="block text-center text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">← Back to sign in</Link>
            </div>
          </>
        )}

        {!isPending && !state && !token && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200">
              <XCircle size={28} className="text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Invalid link</h2>
              <p className="text-[14.5px] text-[#64748B]">This verification link is missing a token.</p>
            </div>
            <Link href="/login" className="text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">← Back to sign in</Link>
          </>
        )}
      </div>

      <form id="verify-form" action={action} className="hidden">
        <input type="hidden" name="token" value={token} />
      </form>
    </div>
  )
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>
}
