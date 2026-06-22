import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex items-center justify-center w-[38px] h-[38px] rounded-[9px] bg-[#2563EB] shadow-lg">
        <span className="text-white font-extrabold text-[19px] leading-none">E</span>
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#2563EB] border-2 border-white animate-pulse" />
      </div>
      <div className="flex flex-col">
        <span className="text-white font-bold text-[19px] leading-tight tracking-tight">Evalora</span>
        <span className="text-[#64748B] font-semibold text-[11.5px] uppercase tracking-widest">Assessment Platform</span>
      </div>
    </div>
  )
}
