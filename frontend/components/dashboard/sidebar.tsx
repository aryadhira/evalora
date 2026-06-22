"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FileText, Users, BarChart3, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/exams", label: "Exams", icon: FileText },
  { href: "/participants", label: "Participants", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-[#0F172A] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-center w-8 h-8 rounded-[7px] bg-[#2563EB]">
          <span className="text-white font-extrabold text-[15px]">E</span>
        </div>
        <span className="text-white font-bold text-[17px] tracking-tight">Evalora</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/settings" ? pathname.startsWith("/settings") : pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-[#2563EB] text-white"
                  : "text-[#94A3B8] hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/[0.06]">
        <p className="text-[11px] text-[#374151]">© 2026 Evalora</p>
      </div>
    </aside>
  )
}
