import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Building2, Calendar, UserCheck, Eye } from 'lucide-react'
import Button from '../ui/Button'

export default function AuditRecordHeader({ record, users = [], onViewFullInfo }) {
  const navigate = useNavigate()

  const recordType = record?.recordType || 'Lead'
  const totalChanges = record?.totalChanges || 18
  const formatUserName = (userId, rawName) => {
    if (userId) {
      const user = users.find((u) => String(u._id || u.id || u.userId) === String(userId));
      if (user) return user.name || user.userName || (user.email ? user.email.split('@')[0] : 'User');
      return String(userId).substring(0, 8) + '...';
    }
    if (!rawName) return 'System'
    if (rawName.includes('@')) {
      const prefix = rawName.split('@')[0]
      return prefix
        .split(/[._-]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')
    }
    return rawName
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Navigation */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/audit')}
            className="flex items-center gap-1.5 text-sm font-bold text-[var(--vz-heading)] hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Audit Logs</span>
          </button>
          
          <div className="text-[11px] text-[var(--vz-text-muted)] hidden sm:flex items-center">
            <span className="mx-2 text-gray-300">|</span>
            <span>CRM</span>
            <span className="mx-1.5">›</span>
            <span>Audit Logs</span>
            <span className="mx-1.5">›</span>
            <span className="text-[var(--vz-heading)] font-semibold">{recordType} Details</span>
          </div>
        </div>

        {/* Right: Stat indicators */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-9 px-3 bg-[var(--vz-card-bg)] shadow-xs"
            onClick={onViewFullInfo}
          >
            <Eye size={14} className="mr-1.5" />
            <span className="text-xs">View {recordType} Detail</span>
          </Button>
          
          {/* Stat: Total Changes */}
          <div className="h-9 px-3 flex items-center gap-2 rounded-md border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[var(--vz-text-muted)] tracking-wider">
              Total Changes:
            </span>
            <span className="text-sm font-extrabold text-[#3577f1]">
              {totalChanges}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
