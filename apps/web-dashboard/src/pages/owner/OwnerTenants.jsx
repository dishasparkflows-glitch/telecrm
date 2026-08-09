import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetOwnerTenantsQuery, useUpdateTenantStatusMutation } from '../../features/owner/ownerApi'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'

import { Search, Eye, Ban, CheckCircle } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'

const STATUS_COLORS = {
  active: 'success', trial: 'info', suspended: 'danger',
  cancelled: 'warning', free: 'primary',
}

export default function OwnerTenants() {
  const navigate = useNavigate()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useGetOwnerTenantsQuery({ page, limit: 20, search, status: statusFilter })
  const [updateStatus] = useUpdateTenantStatusMutation()

  const tenants = data?.data?.tenants || []
  const pagination = data?.data?.pagination || {}

  const handleStatusChange = async (id, status) => {
    try {
      await updateStatus({ id, status }).unwrap()
      toast.success(`Tenant ${status === 'suspended' ? 'suspended' : 'activated'}`)
    } catch (err) {
      toast.error(err.data?.message || 'Failed to update status')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xl font-black text-[var(--vz-heading)]">Tenants</h4>
          <p className="text-sm text-[var(--vz-text-muted)] mt-1">Manage all registered tenants</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
          <input
            type="text" placeholder="Search tenants..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] outline-none focus:border-primary"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val); setPage(1) }}
          className="min-w-[150px]"
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'trial', label: 'Trial' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'free', label: 'Free' }
          ]}
        />
      </div>

      {/* Tenants Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--vz-table-header-bg)] border-b border-[var(--vz-border)]">
                {['Company', 'Email', 'Plan', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--vz-text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vz-border)]">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--vz-text-muted)]">Loading...</td></tr>
              ) : tenants.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--vz-text-muted)]">No tenants found</td></tr>
              ) : tenants.map((t) => {
                const companyName = t.company?.name;
                const slug = t.company?.slug;
                const email = t.company?.email;
                const status = t.status;
                return (
                  <tr key={t._id} className="hover:bg-[var(--vz-body-bg)]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                          {companyName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--vz-heading)]">{companyName}</p>
                          <p className="text-[11px] text-[var(--vz-text-muted)]">{slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--vz-text)]">{email}</td>
                    <td className="px-5 py-4">
                      <Badge color="soft-primary">{t.planId?.name || 'N/A'}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge color={STATUS_COLORS[status] || 'primary'}>{status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-[var(--vz-text-muted)] text-xs">
                      {new Date(t.meta?.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/owner/tenants/${t._id}`)}
                          className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                          title="View Detail"
                        >
                          <Eye size={16} />
                        </button>
                        {status !== 'suspended' ? (
                          <button
                            onClick={() => handleStatusChange(t._id, 'suspended')}
                            className="p-1.5 rounded-md hover:bg-danger/10 text-danger transition-colors"
                            title="Suspend"
                          >
                            <Ban size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(t._id, 'active')}
                            className="p-1.5 rounded-md hover:bg-success/10 text-success transition-colors"
                            title="Activate"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--vz-border)]">
            <p className="text-xs text-[var(--vz-text-muted)]">
              Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button size="sm" variant="ghost" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
