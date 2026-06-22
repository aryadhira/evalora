"use client"

import { useState } from "react"
import { ShieldCheck, ShieldOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TwoFASetupModal } from "./2fa-setup-modal"
import { TwoFADisableModal } from "./2fa-disable-modal"
import { TwoFARegenerateModal } from "./2fa-regenerate-modal"
import type { TOTPStatusResponse } from "@/app/lib/types/auth"

interface Props {
  initialStatus: TOTPStatusResponse | null
}

export function SecuritySettingsClient({ initialStatus }: Props) {
  const [enabled, setEnabled] = useState(initialStatus?.totp_enabled ?? false)
  const [remaining, setRemaining] = useState(initialStatus?.backup_codes_remaining ?? 0)
  const [modal, setModal] = useState<"setup" | "disable" | "regenerate" | null>(null)

  return (
    <>
      <div className="bg-white rounded-[12px] border border-[#E2E8F0] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-[10px] border shrink-0 ${enabled ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]"}`}>
              {enabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[14px] font-semibold text-[#0F172A]">Two-Factor Authentication</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${enabled ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]"}`}>
                  {enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-[13px] text-[#64748B] max-w-sm">
                {enabled
                  ? `Extra layer of security active. ${remaining > 0 ? `${remaining} backup code${remaining !== 1 ? "s" : ""} remaining.` : "No backup codes — consider regenerating."}`
                  : "Add an extra layer of security by requiring a code from your authenticator app when signing in."}
              </p>
            </div>
          </div>

          {!enabled && (
            <Button
              onClick={() => setModal("setup")}
              className="shrink-0 h-9 px-4 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[13px] border-0 shadow-[0_1px_4px_rgba(37,99,235,0.3)]"
            >
              Enable 2FA
            </Button>
          )}
        </div>

        {enabled && (
          <div className="flex gap-2.5 mt-5 pt-5 border-t border-[#F1F5F9]">
            <Button
              onClick={() => setModal("regenerate")}
              variant="outline"
              className="h-9 px-4 rounded-[8px] border-[#E2E8F0] text-[13px] font-medium text-[#374151] gap-2"
            >
              <RefreshCw size={13} />
              Regenerate backup codes
            </Button>
            <Button
              onClick={() => setModal("disable")}
              variant="outline"
              className="h-9 px-4 rounded-[8px] border-red-200 text-[13px] font-medium text-[#EF4444] hover:bg-red-50 gap-2"
            >
              <ShieldOff size={13} />
              Disable 2FA
            </Button>
          </div>
        )}
      </div>

      {modal === "setup" && (
        <TwoFASetupModal
          onClose={() => setModal(null)}
          onEnabled={() => { setEnabled(true); setRemaining(8); setModal(null) }}
        />
      )}

      {modal === "disable" && (
        <TwoFADisableModal
          onClose={() => setModal(null)}
          onDisabled={() => { setEnabled(false); setRemaining(0); setModal(null) }}
        />
      )}

      {modal === "regenerate" && (
        <TwoFARegenerateModal
          onClose={() => { setModal(null); setRemaining(8) }}
        />
      )}
    </>
  )
}
