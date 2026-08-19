import { useState } from 'react'
import { useGetOwnerRevenueQuery } from '../../features/owner/ownerApi'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const COLORS = ['#405189', '#0ab39c', '#f7b84b', '#f06548', '#299cdb']

const tooltipStyle = {
  backgroundColor: 'var(--vz-card-bg)',
  border: '1px solid var(--vz-border)',
  borderRadius: '6px',
  fontSize: '12px',
}

function formatCurrency(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount}`
}

export default function OwnerRevenue() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useGetOwnerRevenueQuery({ page, limit: 30 })

  const d = data?.data || {}
  const revenueByPlan = d.revenueByPlan || []
  const payments = d.payments || []
  const pagination = d.pagination || {}

  const chartData = revenueByPlan.map((r) => ({
    name: r._id || 'Unknown',
    total: r.total,
    count: r.count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-black text-[var(--vz-heading)]">Revenue</h4>
        <p className="text-sm text-[var(--vz-text-muted)] mt-1">Revenue breakdown and payment history</p>
      </div>

      {/* Revenue by Plan Chart */}
      <Card>
        <Card.Header><Card.Title>Revenue by Plan</Card.Title></Card.Header>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--vz-text-muted)' }} />
              <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: 'var(--vz-text-muted)' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" fill="#405189" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-[var(--vz-text-muted)] text-sm">No revenue data yet</div>
        )}
      </Card>

      {/* Payment History */}
      <Card noPadding>
        <Card.Header><Card.Title>Payment History</Card.Title></Card.Header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--vz-table-header-bg)] border-b border-[var(--vz-border)]">
                {['Invoice', 'Tenant', 'Plan', 'Amount', 'Cycle', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--vz-text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vz-border)]">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--vz-text-muted)]">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--vz-text-muted)]">No payments yet</td></tr>
              ) : payments.map((p) => (
                <tr key={p._id} className="hover:bg-[var(--vz-body-bg)]/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">{p.invoice?.number}</td>
                  <td className="px-4 py-3 text-[var(--vz-text)]">{p.tenantId?.companyName || '—'}</td>
                  <td className="px-4 py-3"><Badge color="soft-primary">{p.plan?.name}</Badge></td>
                  <td className="px-4 py-3 font-bold text-[var(--vz-heading)]">₹{p.invoice?.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--vz-text)]">{p.plan?.billingCycle}</td>
                  <td className="px-4 py-3"><Badge color={p.payment?.status === 'completed' || p.payment?.status === 'paid' ? 'success' : 'warning'}>{p.payment?.status}</Badge></td>
                  <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs">{p.payment?.paidAt ? new Date(p.payment?.paidAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--vz-border)]">
            <p className="text-xs text-[var(--vz-text-muted)]">
              Page {page} of {pagination.pages} ({pagination.total} total)
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
