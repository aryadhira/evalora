import { Logo } from "@/components/auth/logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — 42% */}
      <div
        className="hidden lg:flex lg:w-[42%] xl:w-[42%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0d1d40 0%, #0F172A 50%, #020617 100%)" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
        />

        <div className="relative z-10">
          <Logo />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-[32px] font-bold text-white leading-tight tracking-tight">
              The Smart Assessment<br />Platform
            </h1>
            <p className="text-[15px] text-[#64748B] leading-relaxed max-w-xs">
              Create, manage, and deliver exams at scale. Built for educators and organizations who demand reliability.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { icon: "✦", text: "AI-powered question generation" },
              { icon: "✦", text: "Real-time proctoring & analytics" },
              { icon: "✦", text: "Supports 10,000+ concurrent users" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-[#2563EB] text-xs">{f.icon}</span>
                <span className="text-[13px] text-[#94A3B8]">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[11.5px] text-[#374151]">© 2026 Evalora. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — 58% */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2563EB]">
              <span className="text-white font-extrabold text-base">E</span>
            </div>
            <span className="font-bold text-[#0F172A] text-lg">Evalora</span>
          </div>
        </div>

        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          {children}
        </div>
      </div>
    </div>
  )
}
