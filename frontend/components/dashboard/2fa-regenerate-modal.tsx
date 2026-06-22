"use client"

import { useEffect, useState, useActionState } from "react"
import { regenerateBackupAction } from "@/app/_actions/auth"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X, Copy, Check, Loader2 } from "lucide-react"
import type { TOTPBackupResponse } from "@/app/lib/types/auth"

interface Props {
  onClose: () => void
}

export function TwoFARegenerateModal({ onClose }: Props) {
  const [step, setStep] = useState<"confirm" | "codes">("confirm")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [state, action, isPending] = useActionState(regenerateBackupAction, null)

  useEffect(() => {
    if (state?.data) {
      setBackupCodes((state.data as TOTPBackupResponse).backup_codes)
      setStep("codes")
    }
  }, [state])

  function copyAll() {
    navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step === "codes" ? undefined : onClose} />
      <div className="relative bg-white rounded-[16px] border border-[#E2E8F0] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-sm">
        {step !== "codes" && (
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#374151] hover:bg-[#F8FAFC] transition-colors">
            <X size={16} />
          </button>
        )}

        <div className="p-6 space-y-5">
          {step === "confirm" && (
            <>
              <div className="space-y-1">
                <h3 className="text-[17px] font-bold text-[#0F172A]">Regenerate backup codes</h3>
                <p className="text-[13px] text-[#64748B]">Enter your current 6-digit code to generate new backup codes. Your old codes will be invalidated.</p>
              </div>

              <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-3 text-[12.5px] text-amber-700">
                ⚠ Existing backup codes will stop working immediately.
              </div>

              <form action={action} className="space-y-4">
                <div>
                  <Label htmlFor="totp_code">Authenticator code</Label>
                  <Input
                    id="totp_code"
                    name="totp_code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000 000"
                    maxLength={7}
                    autoComplete="one-time-code"
                    className="text-center tracking-[0.3em] font-mono text-[18px]"
                    aria-invalid={!!state?.errors?.totp_code}
                  />
                  {state?.errors?.totp_code && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.totp_code}</p>}
                  {state?.error && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.error}</p>}
                </div>

                <div className="flex gap-3">
                  <Button type="button" onClick={onClose} variant="outline" className="flex-1 h-10 rounded-[10px] border-[#E2E8F0] text-[13px] font-medium">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending} className="flex-1 h-10 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] border-0">
                    {isPending && <Loader2 size={14} className="animate-spin mr-2" />}
                    {isPending ? "Generating…" : "Regenerate"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === "codes" && (
            <>
              <div className="space-y-1">
                <h3 className="text-[17px] font-bold text-[#0F172A]">New backup codes</h3>
                <p className="text-[13px] text-[#64748B]">Your old codes are now invalid. Save these somewhere safe.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px]">
                {backupCodes.map((code) => (
                  <span key={code} className="font-mono text-[13px] text-[#0F172A] text-center py-1">{code}</span>
                ))}
              </div>

              <div className="flex gap-3">
                <Button type="button" onClick={copyAll} variant="outline" className="flex-1 h-10 rounded-[10px] border-[#E2E8F0] text-[13px] font-medium gap-2">
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy all"}
                </Button>
                <Button type="button" onClick={onClose} className="flex-1 h-10 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] border-0">
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
