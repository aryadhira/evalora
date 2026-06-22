"use client"

import { useState } from "react"
import { logoutAction } from "@/app/_actions/auth"
import { LogOut, ChevronDown, User } from "lucide-react"

export function Topbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="flex items-center justify-between h-16 px-6 lg:px-8 bg-white border-b border-[#E2E8F0] shrink-0">
      <div className="flex flex-col">
        <h1 className="text-[15px] font-semibold text-[#0F172A] leading-tight">Dashboard</h1>
        <p className="text-[12px] text-[#94A3B8]">Welcome back to Evalora</p>
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-all"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#EFF6FF] border border-[#DBEAFE]">
            <User size={14} className="text-[#2563EB]" />
          </div>
          <span className="text-[13px] font-medium text-[#374151] hidden sm:block">Account</span>
          <ChevronDown size={14} className="text-[#94A3B8]" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-[10px] border border-[#E2E8F0] shadow-[0_4px_20px_rgba(0,0,0,0.1)] z-20 overflow-hidden">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-[#EF4444] hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
