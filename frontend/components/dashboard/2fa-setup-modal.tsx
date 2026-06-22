"use client"

import { useEffect, useState, useActionState } from "react"
import QRCode from "react-qr-code"
import { setupTOTPAction, enableTOTPAction } from "@/app/_actions/auth"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X, Copy, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import type { TOTPSetupResponse, TOTPEnableResponse } from "@/app/lib/types/auth"

interface Props {
  onClose: () => void
  onEnabled: () => void
}

export function TwoFASetupModal({ onClose, onEnabled }: Props) {
  const [step, setStep] = useState<"loading" | "scan" | "backup">("loading")
  const [setupData, setSetupData] = useState<TOTPSetupResponse | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [state, action, isPending] = useActionState(enableTOTPAction, null)

  useEffect(() => {
    setupTOTPAction().then((res) => {
      if (res?.data) {
        setSetupData(res.data as TOTPSetupResponse)
        setStep("scan")
      }
    })
  }, [])

  useEffect(() => {
    if (state?.data) {
      const codes = (state.data as TOTPEnableResponse).backup_codes
      setBackupCodes(codes)
      setStep("backup")
    }
  }, [state])

  function copyAll() {
    navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step === "backup" ? undefined : onClose} />
      <div className="relative bg-white rounded-[16px] border border-[#E2E8F0] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-md">
        {step !== "backup" && (
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#374151] hover:bg-[#F8FAFC] transition-colors">
            <X size={16} />
          </button>
        )}

        <div className="p-6">
          {step === "loading" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 size={24} className="animate-spin text-[#2563EB]" />
              <p className="text-[13px] text-[#64748B]">Generating your QR code…</p>
            </div>
          )}

          {step === "scan" && setupData && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-[17px] font-bold text-[#0F172A]">Set up two-factor authentication</h3>
                <p className="text-[13px] text-[#64748B]">Scan this QR code with your authenticator app, then enter the 6-digit code to verify.</p>
              </div>

              <div className="flex justify-center p-4 bg-white border border-[#E2E8F0] rounded-[12px]">
                <QRCode value={setupData.otp_url} size={180} />
              </div>

              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="flex items-center gap-1.5 text-[12.5px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
              >
                {showSecret ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Can&apos;t scan? Enter code manually
              </button>

              {showSecret && (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-3">
                  <p className="text-[11px] text-[#94A3B8] mb-1">Secret key</p>
                  <p className="font-mono text-[13px] text-[#0F172A] break-all">{setupData.secret}</p>
                </div>
              )}

              <form action={action} className="space-y-4">
                <input type="hidden" name="secret" value={setupData.secret} />
                <div>
                  <Label htmlFor="totp_code">Verification code</Label>
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
                <Button type="submit" disabled={isPending} className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] border-0 shadow-[0_1px_4px_rgba(37,99,235,0.3)] transition-all active:translate-y-px">
                  {isPending && <Loader2 size={16} className="animate-spin mr-2" />}
                  {isPending ? "Verifying…" : "Verify & Enable"}
                </Button>
              </form>
            </div>
          )}

          {step === "backup" && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-[17px] font-bold text-[#0F172A]">Save your backup codes</h3>
                <p className="text-[13px] text-[#64748B]">Store these somewhere safe. Each code can only be used once.</p>
              </div>

              <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-3 text-[12.5px] text-amber-700">
                ⚠ These codes will not be shown again after you close this dialog.
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
                <Button type="button" onClick={onEnabled} className="flex-1 h-10 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] border-0">
                  I&apos;ve saved these — Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
