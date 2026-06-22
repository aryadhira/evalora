"use client"

import { Suspense, useActionState, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { totpChallengeAction } from "@/app/_actions/auth"
import { ShieldCheck, Loader2 } from "lucide-react"

function TOTPChallengeContent() {
  const searchParams = useSearchParams()
  const pendingToken = searchParams.get("pending_token") ?? ""
  const [state, action, isPending] = useActionState(totpChallengeAction, null)
  const [useBackup, setUseBackup] = useState(false)

  return (
    <div className="space-y-7">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE]">
          <ShieldCheck size={28} className="text-[#2563EB]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">Two-factor authentication</h2>
          <p className="text-[14.5px] text-[#64748B]">
            {useBackup ? "Enter one of your backup codes to sign in" : "Enter the 6-digit code from your authenticator app"}
          </p>
        </div>
      </div>

      <form action={action} className="space-y-[15px]">
        <input type="hidden" name="pending_token" value={pendingToken} />

        {state?.error && (
          <div className="rounded-[10px] bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-[#EF4444]">
            {state.error}
          </div>
        )}

        <div>
          <Label htmlFor="totp_code">{useBackup ? "Backup code" : "Authentication code"}</Label>
          <Input
            id="totp_code"
            name="totp_code"
            type="text"
            inputMode={useBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            placeholder={useBackup ? "xxxxxxxxxx" : "000 000"}
            maxLength={useBackup ? 12 : 6}
            aria-invalid={!!state?.errors?.totp_code}
            className="text-center tracking-[0.3em] font-mono text-[18px]"
          />
          {state?.errors?.totp_code && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.totp_code}</p>}
        </div>

        <Button type="submit" disabled={isPending || !pendingToken} className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] border-0 shadow-[0_1px_4px_rgba(37,99,235,0.3)] transition-all active:translate-y-px">
          {isPending && <Loader2 size={16} className="animate-spin mr-2" />}
          {isPending ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <div className="space-y-3 text-center">
        <button type="button" onClick={() => setUseBackup((v) => !v)} className="text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
          {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
        </button>
        <div />
        <Link href="/login" className="block text-[13px] text-[#64748B] hover:text-[#374151] transition-colors">← Back to sign in</Link>
      </div>
    </div>
  )
}

export default function TOTPChallengePage() {
  return <Suspense><TOTPChallengeContent /></Suspense>
}
