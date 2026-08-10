import Select from '../ui/Select'
import { useListUsersQuery } from '../../features/users/userApi'

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
]

const DEFAULT_USER_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'Disha Radadiya', label: 'Disha Radadiya' },
  { value: 'Amit Patel', label: 'Amit Patel' },
  { value: 'Priya Sharma', label: 'Priya Sharma' },
  { value: 'Rahul Mehta', label: 'Rahul Mehta' },
]

export default function AuditRecordInfo({ record, filters, onFilterChange }) {
  const recordName = record?.recordName || 'John Doe'
  const recordType = record?.recordType || 'Lead'
  const recordId = record?.recordId || 'LEAD-2025-00125'
  const phone = record?.phone || '9876543210'
  const email = record?.email || 'john.doe@example.com'
  const branchName = record?.branchName || 'Head Office'
  const ownerName = record?.ownerName || 'Amit Patel'

  const { data: userData } = useListUsersQuery()
  const liveUsers = userData?.data || userData || []
  let userOptions = [{ value: 'all', label: 'All Users' }]
  if (Array.isArray(liveUsers) && liveUsers.length > 0) {
    liveUsers.forEach((u) => {
      const label = u.name || u.userName || (u.email ? u.email.split('@')[0] : 'User')
      userOptions.push({
        value: u._id || u.id || u.userId || label,
        label,
      })
    })
  } else {
    userOptions = DEFAULT_USER_OPTIONS
  }

  return (
    <div className="space-y-4">

      {/* QUICK FILTERS CARD */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-[var(--vz-heading)] pb-2 border-b border-[var(--vz-border)]">
          Quick Filters
        </h3>

        <div className="space-y-2">
          <Select
            options={ACTION_OPTIONS}
            value={filters.action || 'all'}
            onChange={(val) => onFilterChange('action', val)}
            placeholder="All Actions"
            className="text-xs w-full"
          />

          <Select
            options={userOptions}
            value={filters.userId || filters.user || 'all'}
            onChange={(val) => {
              onFilterChange('userId', val)
              onFilterChange('user', val)
            }}
            placeholder="All Users"
            className="text-xs w-full"
          />
        </div>
      </div>
    </div>
  )
}
