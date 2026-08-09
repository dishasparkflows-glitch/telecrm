import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Building2, Calendar, UserCheck } from 'lucide-react'

export default function AuditRecordHeader({ record }) {
  const navigate = useNavigate()

  const recordName = record?.recordName || 'John Doe'
  const recordType = record?.recordType || 'Lead'
  const recordId = record?.recordId || 'LEAD-2025-00125'
  const branchName = record?.branchName || 'Ahmedabad Branch'
  const ownerName = record?.ownerName || 'Amit Patel'
  const createdDate = record?.createdAt ? new Date(record.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '01 May 2025 10:25 AM'
  const totalChanges = record?.totalChanges || 18
  const formatUserName = (rawName) => {
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
  const createdByName = formatUserName(record?.createdBy?.userName || 'Disha Radadiya')
  const createdByRole = record?.createdBy?.userRole || 'super admin'

  return (
    <div className="space-y-3">
      {/* Top Bar Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/audit')}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--vz-heading)] hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Audit Logs</span>
        </button>

        <div className="text-[11px] text-[var(--vz-text-muted)]">
          <span>CRM</span>
          <span className="mx-1.5">›</span>
          <span>Audit Logs</span>
          <span className="mx-1.5">›</span>
          <span className="text-[var(--vz-heading)] font-semibold">{recordType} Details</span>
        </div>
      </div>

      {/* Main Record Header Card */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Icon & Title & Metadata */}
          <div className="flex items-start gap-3.5 min-w-[280px]">
            <div className="w-12 h-12 rounded-xl bg-[#7047eb]/10 text-[#7047eb] flex items-center justify-center font-bold shrink-0 mt-0.5">
              <User size={22} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[var(--vz-heading)] leading-tight">
                  {recordType}: <span className="font-semibold">{recordName}</span>
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#0ab39c]/15 text-[#088d7b]">
                  Active
                </span>
              </div>

              {/* Subtitle details */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[var(--vz-text-muted)]">
                <div>
                  <span className="font-semibold text-[var(--vz-heading)]">{recordType} ID:</span>{' '}
                  <span className="font-semibold text-[var(--vz-heading)]">{recordId}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Building2 size={13} className="text-[var(--vz-text-muted)]" />
                  <span>Branch: <strong className="text-[var(--vz-heading)] font-semibold">{branchName}</strong></span>
                </div>

                <div className="flex items-center gap-1">
                  <Calendar size={13} className="text-[var(--vz-text-muted)]" />
                  <span>Created: <strong className="text-[var(--vz-heading)] font-semibold">{createdDate}</strong></span>
                </div>

                <div className="flex items-center gap-1">
                  <UserCheck size={13} className="text-[var(--vz-text-muted)]" />
                  <span>Owner: <strong className="text-[var(--vz-heading)] font-semibold">{ownerName}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Stat indicators */}
          <div className="flex items-center gap-3">
            {/* Stat 1: Total Changes */}
            <div className="px-4 py-2.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-left min-w-[110px]">
              <div className="text-[10px] font-bold uppercase text-[var(--vz-text-muted)] tracking-wider">
                Total Changes
              </div>
              <div className="text-xl font-extrabold text-[#3577f1] leading-none mt-1">
                {totalChanges}
              </div>
            </div>

            {/* Stat 2: Last Updated */}
            <div className="px-4 py-2.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-left min-w-[130px]">
              <div className="text-[10px] font-bold uppercase text-[var(--vz-text-muted)] tracking-wider">
                Last Updated
              </div>
              <div className="text-xs font-bold text-[var(--vz-heading)] mt-1">
                08 May 2025
              </div>
              <div className="text-[10px] text-[var(--vz-text-muted)]">
                03:25 PM
              </div>
            </div>

            {/* Stat 3: Created By */}
            <div className="px-4 py-2.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-left min-w-[140px]">
              <div className="text-[10px] font-bold uppercase text-[var(--vz-text-muted)] tracking-wider">
                Created By
              </div>
              <div className="mt-1">
                <div className="text-xs font-bold text-[var(--vz-heading)] leading-none">
                  {createdByName}
                </div>
                <div className="text-[10px] text-[var(--vz-text-muted)] leading-none mt-1 capitalize">
                  {createdByRole}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
