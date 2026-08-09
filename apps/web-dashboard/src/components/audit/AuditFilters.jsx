import { useState } from 'react'
import { Search, Download, Filter, Calendar } from 'lucide-react'
import Select from '../ui/Select'
import Button from '../ui/Button'
import { useListBranchesQuery } from '../../features/branches/branchApi'
import { useListUsersQuery } from '../../features/users/userApi'

const MODULE_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'leads', label: 'Leads' },
  { value: 'branches', label: 'Branches' },
  { value: 'users', label: 'Users' },
  { value: 'roles', label: 'Roles & Permissions' },
  { value: 'settings', label: 'Settings' },
  { value: 'automations', label: 'Automations' },
  { value: 'calls', label: 'Calls' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'VIEW', label: 'View' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
]

const DEFAULT_USER_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'Disha Radadiya', label: 'Disha Radadiya' },
  { value: 'Amit Patel', label: 'Amit Patel' },
  { value: 'Priya Sharma', label: 'Priya Sharma' },
  { value: 'Rahul Mehta', label: 'Rahul Mehta' },
]

const DEFAULT_BRANCH_OPTIONS = [
  { value: 'all', label: 'All Branches' },
  { value: 'Head Office', label: 'Head Office' },
  { value: 'Ahmedabad Branch', label: 'Ahmedabad Branch' },
  { value: 'Mumbai Branch', label: 'Mumbai Branch' },
  { value: 'Delhi Branch', label: 'Delhi Branch' },
]

export default function AuditFilters({
  filters,
  onFilterChange,
  onExport,
  showExtraFilters = true,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { data: branchData } = useListBranchesQuery(undefined, { skip: !showExtraFilters })
  const { data: userData } = useListUsersQuery(undefined, { skip: !showExtraFilters })

  // Process live branches -> map value to branchId
  const liveBranches = branchData?.data || branchData || []
  let branchOptions = [{ value: 'all', label: 'All Branches' }]
  if (Array.isArray(liveBranches) && liveBranches.length > 0) {
    liveBranches.forEach((b) => {
      branchOptions.push({
        value: b._id || b.id || b.branchId || b.name,
        label: b.name || b.branchName || 'Branch',
      })
    })
  } else {
    branchOptions = DEFAULT_BRANCH_OPTIONS
  }

  // Process live users -> map value to userId
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Range Selector */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] hover:border-primary transition-colors cursor-pointer"
          >
            <Calendar size={14} className="text-[var(--vz-text-muted)]" />
            <span>{filters.dateRangeLabel || '01 May 2025 - 08 May 2025'}</span>
          </button>
        </div>

        {/* Modules Filter - Custom Select */}
        <Select
          options={MODULE_OPTIONS}
          value={filters.module || 'all'}
          onChange={(val) => onFilterChange('module', val)}
          placeholder="All Modules"
          className="min-w-[130px] text-xs"
        />

        {/* Actions Filter - Custom Select */}
        <Select
          options={ACTION_OPTIONS}
          value={filters.action || 'all'}
          onChange={(val) => onFilterChange('action', val)}
          placeholder="All Actions"
          className="min-w-[120px] text-xs"
        />

        {/* Users Filter - Custom Select */}
        {showExtraFilters && (
          <Select
            options={userOptions}
            value={filters.user || filters.userId || 'all'}
            onChange={(val) => {
              onFilterChange('user', val)
              onFilterChange('userId', val)
            }}
            placeholder="All Users"
            className="min-w-[140px] text-xs"
          />
        )}

        {/* Branches Filter - Custom Select */}
        {showExtraFilters && (
          <Select
            options={branchOptions}
            value={filters.branch || filters.branchId || 'all'}
            onChange={(val) => {
              onFilterChange('branch', val)
              onFilterChange('branchId', val)
            }}
            placeholder="All Branches"
            className="min-w-[150px] text-xs"
          />
        )}

        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
          <input
            type="text"
            placeholder="Search by record ID, name, user or changes..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-xs text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] outline-none focus:border-primary"
          />
        </div>

        {/* Action Buttons using SparkCRM Button Component */}
        <div className="flex items-center gap-2 ml-auto">
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="px-3 py-2 text-xs"
            >
              <Download size={14} />
              <span>Export</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-2 text-xs"
          >
            <Filter size={14} />
            <span>Filters</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
