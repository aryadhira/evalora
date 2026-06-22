import { getTOTPStatusAction } from "@/app/_actions/auth"
import { SecuritySettingsClient } from "@/components/dashboard/security-settings"

export default async function SecuritySettingsPage() {
  const status = await getTOTPStatusAction()
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-[22px] font-bold text-[#0F172A] tracking-tight">Security</h2>
        <p className="text-[14px] text-[#64748B] mt-0.5">Manage your account security settings</p>
      </div>
      <SecuritySettingsClient initialStatus={status} />
    </div>
  )
}
