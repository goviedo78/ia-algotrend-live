interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  color?: 'blue' | 'green' | 'red' | 'amber' | 'cyan' | 'default'
  icon?: string
  large?: boolean
}

const COLORS = {
  blue: { text: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  green: { text: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
  red: { text: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  amber: { text: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  cyan: { text: '#22D3EE', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)' },
  default: { text: '#E5E7EB', bg: 'rgba(255,255,255,0.03)', border: 'rgba(31,41,55,1)' },
}

export default function StatCard({ label, value, subtitle, color = 'default', icon, large }: StatCardProps) {
  const c = COLORS[color]

  return (
    <div
      className="rounded-xl border p-4 transition-all hover:scale-[1.02]"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-[#9CA3AF] font-medium">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p
        className={`font-bold font-mono mt-1 ${large ? 'text-3xl' : 'text-2xl'}`}
        style={{ color: c.text }}
      >
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </p>
      {subtitle && (
        <p className="text-xs text-[#6B7280] mt-1">{subtitle}</p>
      )}
    </div>
  )
}
