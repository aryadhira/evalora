import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-all",
        "focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10",
        "hover:border-[#CBD5E1]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-[#EF4444] aria-invalid:ring-3 aria-invalid:ring-[#EF4444]/10",
        className
      )}
      {...props}
    />
  )
}

export { Input }
