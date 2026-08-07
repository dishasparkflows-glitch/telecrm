import { useGetOwnerDashboardQuery } from '../../features/owner/ownerApi'
import KPICard from '../../components/ui/KPICard'
import Card from '../../components/ui/Card'
import { Users, DollarSign, TrendingUp, UserPlus, Shield, CreditCard } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const COLORS = ['#405189', '#0ab39c', '#f7b84b', '#f06548', '#299cdb', '#8b5cf6']
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const tooltipStyle = {
  backgroundColor: 'var(--vz-card-bg)',
  border: '1px solid var(--vz-border)',
  borderRadius: '6px',
  fontSize: '12px',
}

const EmptyState = ({ message }) => (
  <div className="flex items-center justify-center h-[200px] text-[var(--vz-text-muted)] text-sm">{message}</div>
)

function formatCurrency(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount}`
}

export default function OwnerDashboard() {
  const { data, isLoading } = useGetOwnerDashboardQuery()
  const d = data?.data || {}
  const kpis = d.kpis || {}
  const charts = d.charts || {}

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-[var(--vz-text-muted)]">Loading dashboard...</div>
  }

  // Process chart data
  const tenantTrend = (charts.monthlyTenantTrend || []).map((t) => ({
    month: MONTH_NAMES[t._id?.month] || '',
    count: t.count,
  }))

  const revenueTrend = (charts.monthlyRevenueTrend || []).map((t) => ({
    month: MONTH_NAMES[t._id?.month] || '',
    total: t.total,
  }))

  const planDist = (charts.planDistribution || []).map((p) => ({
    name: p.planName || 'Unknown',
    value: p.count,
  }))

  const statusDist = (charts.tenantsByStatus || []).map((s) => ({
    name: s._id?.charAt(0).toUpperCase() + s._id?.slice(1) || 'Unknown',
    value: s.count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-black text-[var(--vz-heading)]">Owner Dashboard</h4>
        <p className="text-sm text-[var(--vz-text-muted)] mt-1">System-wide overview and metrics</p>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Total Tenants" value={kpis.totalTenants || 0} icon={Users} iconColor="primary" />
        <KPICard title="Active Tenants" value={kpis.activeTenants || 0} icon={Shield} iconColor="success" />
        <KPICard title="Trial Tenants" value={kpis.trialTenants || 0} icon={UserPlus} iconColor="info" />
        <KPICard title="Revenue (Month)" value={formatCurrency(kpis.revenueThisMonth || 0)} icon={DollarSign} iconColor="warning" />
        <KPICard title="Revenue (Year)" value={formatCurrency(kpis.revenueThisYear || 0)} icon={TrendingUp} iconColor="secondary" />
        <KPICard title="Revenue (All)" value={formatCurrency(kpis.revenueAllTime || 0)} icon={CreditCard} iconColor="primary" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="New Today" value={kpis.newTenantsToday || 0} icon={UserPlus} iconColor="info" />
        <KPICard title="New This Month" value={kpis.newTenantsThisMonth || 0} icon={Users} iconColor="primary" />
        <KPICard title="Total Users" value={kpis.totalUsers || 0} icon={Users} iconColor="success" />
        <KPICard title="Total Leads" value={kpis.totalLeads || 0} icon={TrendingUp} iconColor="warning" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Growth Trend */}
        <Card>
          <Card.Header><Card.Title>Tenant Growth (Last 12 Months)</Card.Title></Card.Header>
          {tenantTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={tenantTrend}>
                <defs>
                  <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#405189" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#405189" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--vz-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--vz-text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#405189" strokeWidth={2} fill="url(#colorTenants)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No tenant data yet" />}
        </Card>

        {/* Revenue Trend */}
        <Card>
          <Card.Header><Card.Title>Revenue Trend (Last 12 Months)</Card.Title></Card.Header>
          {revenueTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--vz-text-muted)' }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11, fill: 'var(--vz-text-muted)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="total" fill="#0ab39c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No revenue data yet" />}
        </Card>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <Card>
          <Card.Header><Card.Title>Tenants by Plan</Card.Title></Card.Header>
          {planDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name">
                    {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : <EmptyState message="No plans data yet" />}
        </Card>

        {/* Status Distribution */}
        <Card>
          <Card.Header><Card.Title>Tenants by Status</Card.Title></Card.Header>
          {statusDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusDist} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name">
                  {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No status data yet" />}
        </Card>
      </div>
    </div>
  )
}
