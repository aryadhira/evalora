import { FileText, Users, CheckCircle, Clock } from "lucide-react"

const STATS = [
  { label: "Total Exams", value: "—", icon: FileText, color: "bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]" },
  { label: "Participants", value: "—", icon: Users, color: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]" },
  { label: "Completed", value: "—", icon: CheckCircle, color: "bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA]" },
  { label: "In Progress", value: "—", icon: Clock, color: "bg-[#FAF5FF] text-[#9333EA] border-[#E9D5FF]" },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[22px] font-bold text-[#0F172A] tracking-tight">Overview</h2>
        <p className="text-[14px] text-[#64748B] mt-0.5">Your assessment platform at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-[12px] border border-[#E2E8F0] p-5 flex items-center gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className={`flex items-center justify-center w-10 h-10 rounded-[10px] border ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-[22px] font-bold text-[#0F172A] leading-none">{value}</p>
              <p className="text-[12.5px] text-[#64748B] mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[12px] border border-[#E2E8F0] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Recent Exams</h3>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] mb-3">
              <FileText size={20} className="text-[#CBD5E1]" />
            </div>
            <p className="text-[13px] text-[#94A3B8]">No exams yet</p>
            <p className="text-[12px] text-[#CBD5E1] mt-0.5">Create your first exam to get started</p>
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-[#E2E8F0] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">Recent Activity</h3>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] mb-3">
              <Clock size={20} className="text-[#CBD5E1]" />
            </div>
            <p className="text-[13px] text-[#94A3B8]">No activity yet</p>
            <p className="text-[12px] text-[#CBD5E1] mt-0.5">Activity will appear here once you start</p>
          </div>
        </div>
      </div>
    </div>
  )
}
