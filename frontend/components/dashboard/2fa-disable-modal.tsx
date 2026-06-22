"use client"

import { useActionState } from "react"
import { disableTOTPAction } from "@/app/_actions/auth"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X, Loader2, ShieldOff } from "lucide-react"

interface Props {
  onClose: () => void
  onDisabled: () => void
}

export function TwoFADisableModal({ onClose, onDisabled }: Props) {
  const [state, action, isPending] = useActionState(disableTOTPAction, null)

  if (state?.data && (state.data as any).disabled) {
    onDisabled()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] border border-[#E2E8F0] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-sm">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#374151] hover:bg-[#F8FAFC] transition-colors">
          <X size={16} />
        </button>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-red-50 border border-red-200 shrink-0">
              <ShieldOff size={18} className="text-[#EF4444]" />
            </div>
            <div className="space-y-1 pt-0.5">
              <h3 className="text-[17px] font-bold text-[#0F172A]">Disable 2FA</h3>
              <p className="text-[13px] text-[#64748B]">This will remove two-factor authentication from your account. Enter your password to confirm.</p>
            </div>
          </div>

          <form action={action} className="space-y-4">
            <div>
              <Label htmlFor="password">Current password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!state?.errors?.password}
              />
              {state?.errors?.password && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.errors.password}</p>}
              {state?.error && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{state.error}</p>}
            </div>

            <div className="flex gap-3">
              <Button type="button" onClick={onClose} variant="outline" className="flex-1 h-10 rounded-[10px] border-[#E2E8F0] text-[13px] font-medium">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1 h-10 rounded-[10px] bg-[#EF4444] hover:bg-red-600 text-white font-semibold text-[13px] border-0 transition-all">
                {isPending && <Loader2 size={14} className="animate-spin mr-2" />}
                {isPending ? "Disabling…" : "Disable 2FA"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
