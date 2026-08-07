import { useState, Component } from 'react'
import { useSelector } from 'react-redux'
import { 
  useGetLeadAnalyticsQuery, 
  useGetCallAnalyticsQuery, 
  useGetTeamAnalyticsQuery, 
  useGetRevenueAnalyticsQuery,
  useGetDashboardQuery
} from '../../features/analytics/analyticsApi'
import Card from '../../components/ui/Card'
import Tabs from '../../components/ui/Tabs'
import Badge from '../../components/ui/Badge'

import { 
  Phone, Users, DollarSign, Target, TrendingUp,
  Layers, MousePointer2, CalendarDays
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const COLORS = ['#405189', '#0ab39c', '#f7b84b', '#f06548', '#299cdb', '#8b5cf6', '#ec4899']

// Error boundary for charts
class SafeChart extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return <div className="flex items-center justify-center h-[240px] text-[var(--vz-text-muted)] text-xs italic">Unable to render chart data</div>
    return this.props.children
  }
}

const tooltipProps = {
  contentStyle: { background: 'var(--vz-card-bg)', border: '1px solid var(--vz-border)', borderRadius: 8, fontSize: 12, boxShadow: 'var(--vz-shadow)' },
  itemStyle: { padding: '2px 0' },
  cursor: { fill: 'rgba(0,0,0,0.05)' }
}

const axisProps = {
  tick: { fill: 'var(--vz-text-muted)', fontSize: 11 },
  axisLine: { stroke: 'var(--vz-border)' },
  tickLine: false
}

const EmptyState = ({ icon: Icon, message, submessage }) => (
  <div className="flex flex-col items-center justify-center h-[280px] text-[var(--vz-text-muted)]">
    <Icon size={36} className="mb-3 opacity-20" />
    <p className="text-sm font-medium">{message}</p>
    {submessage && <p className="text-xs mt-1 opacity-60">{submessage}</p>}
  </div>
)

/* ---------- Sub-Components ---------- */

const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card className="relative overflow-hidden group">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center text-${color} transition-transform group-hover:scale-110`}>
        <Icon size={24} />
      </div>
    </div>
    <h6 className="text-[var(--vz-text-muted)] text-xs font-bold uppercase tracking-wider mb-1">{title}</h6>
    <h3 className="text-2xl font-black text-[var(--vz-heading)]">{value}</h3>
    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/0 to-white/5 pointer-events-none" />
  </Card>
)

const WelcomeWidget = ({ name }) => (
  <Card className="bg-primary overflow-hidden relative border-none">
    <div className="relative z-10 flex items-center justify-between">
      <div className="space-y-2 p-2">
        <h4 className="text-xl font-bold text-white">Welcome Back, {name}!</h4>
        <p className="text-white/80 text-sm max-w-sm">
          Here are your real-time analytics and insights. All data is pulled directly from your CRM database.
        </p>
      </div>
      <div className="hidden sm:block">
        <Layers size={120} className="text-white/10 -rotate-12 translate-x-4" />
      </div>
    </div>
    <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute bottom-[-50%] left-[-10%] w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
  </Card>
)

/* ---------- Tab Contents ---------- */

function LeadsTab({ data }) {
  const conversionFunnel = data?.conversionFunnel || {}
  const sourceDistribution = data?.sourceDistribution || {}

  const funnel = Object.entries(conversionFunnel)
    .filter(([, count]) => count > 0)
    .map(([stage, count]) => ({
      stage: stage.charAt(0).toUpperCase() + stage.slice(1),
      count,
    }))

  const bySource = Object.entries(sourceDistribution)
    .filter(([, count]) => count > 0)
    .map(([source, count]) => ({
      name: source.charAt(0).toUpperCase() + source.slice(1).replace('_', ' '),
      value: count,
    }))

  const hasFunnel = funnel.length > 0
  const hasSource = bySource.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <Card.Header className="flex items-center justify-between">
          <Card.Title>Lead Conversion Funnel</Card.Title>
          <Badge color="soft-primary">Live Data</Badge>
        </Card.Header>
        {hasFunnel ? (
          <SafeChart>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
                <XAxis type="number" {...axisProps} hide />
                <YAxis dataKey="stage" type="category" width={90} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" fill="#405189" radius={[0, 4, 4, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </SafeChart>
        ) : (
          <EmptyState icon={Target} message="No leads data yet" submessage="Create leads to see your conversion funnel" />
        )}
      </Card>

      <Card>
        <Card.Header><Card.Title>Leads by Source</Card.Title></Card.Header>
        {hasSource ? (
          <div className="relative">
            <SafeChart>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={bySource} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name">
                    {bySource.map((_, i) => <Cell key={`pie-${i}`} fill={COLORS[i % COLORS.length]} cornerRadius={4} />)}
                  </Pie>
                  <Tooltip {...tooltipProps} />
                </PieChart>
              </ResponsiveContainer>
            </SafeChart>
            <div className="mt-4 space-y-2">
              {bySource.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[var(--vz-text-muted)]">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {s.name}
                  </div>
                  <span className="font-bold text-[var(--vz-heading)]">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={MousePointer2} message="No source data" submessage="Lead sources will appear here" />
        )}
      </Card>

      <Card className="lg:col-span-3">
        <Card.Header><Card.Title>Source & Campaign Conversion</Card.Title></Card.Header>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="overflow-x-auto">
            <p className="text-xs font-bold uppercase text-[var(--vz-text-muted)] mb-2">By Source</p>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[var(--vz-border)]"><th className="py-2 text-left">Source</th><th>Total</th><th>Won</th><th>Rate</th></tr></thead>
              <tbody>{(data?.sourceConversion || []).map((row) => <tr key={row.source} className="border-b border-[var(--vz-border)]"><td className="py-2 capitalize">{row.source.replace('_', ' ')}</td><td className="text-center">{row.total}</td><td className="text-center">{row.won}</td><td className="text-center font-bold text-primary">{row.conversionRate}%</td></tr>)}</tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <p className="text-xs font-bold uppercase text-[var(--vz-text-muted)] mb-2">By Campaign</p>
            {(data?.campaignConversion || []).length ? (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--vz-border)]"><th className="py-2 text-left">Campaign</th><th>Total</th><th>Won</th><th>Rate</th></tr></thead>
                <tbody>{data.campaignConversion.map((row) => <tr key={row.campaignId} className="border-b border-[var(--vz-border)]"><td className="py-2">{row.campaignName}</td><td className="text-center">{row.total}</td><td className="text-center">{row.won}</td><td className="text-center font-bold text-primary">{row.conversionRate}%</td></tr>)}</tbody>
              </table>
            ) : <p className="text-sm text-[var(--vz-text-muted)] py-6">Campaign attribution appears after ad-generated leads arrive.</p>}
          </div>
        </div>
      </Card>
    </div>
  )
}

function CallsTab({ data }) {
  const callVolume = data?.callVolume || []
  const disposition = data?.dispositionBreakdown || {}

  const dispositionData = Object.entries(disposition)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
    }))

  const hasCallVolume = callVolume.length > 0
  const hasDisposition = dispositionData.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <Card.Header><Card.Title>Call Volume by Day</Card.Title></Card.Header>
        {hasCallVolume ? (
          <SafeChart>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={callVolume}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" fill="#299cdb" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </SafeChart>
        ) : (
          <EmptyState icon={Phone} message="No call data yet" submessage="Make calls to see volume trends" />
        )}
      </Card>

      <Card>
        <Card.Header><Card.Title>Call Outcome Distribution</Card.Title></Card.Header>
        {hasDisposition ? (
          <SafeChart>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={dispositionData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="name">
                  {dispositionData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipProps} />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
              </PieChart>
            </ResponsiveContainer>
          </SafeChart>
        ) : (
          <EmptyState icon={Phone} message="No call outcomes yet" submessage="Call outcomes will appear here" />
        )}
      </Card>

      <Card className="lg:col-span-2">
        <Card.Header><Card.Title>Hour-by-Hour Call Activity</Card.Title></Card.Header>
        <SafeChart>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data?.hourlyActivity || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
              <XAxis dataKey="label" {...axisProps} interval={2} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Area type="monotone" dataKey="total" name="Total Calls" stroke="#405189" fill="#405189" fillOpacity={0.15} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#0ab39c" fill="#0ab39c" fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </SafeChart>
      </Card>
    </div>
  )
}

function TeamTab({ data }) {
  const leadsPerAgent = data?.leadsPerAgent || []
  const callsPerAgent = data?.callsPerAgent || []

  const hasData = leadsPerAgent.length > 0 || callsPerAgent.length > 0

  if (!hasData) {
    return (
      <Card>
        <EmptyState icon={Users} message="No team performance data yet" submessage="Team stats will appear as agents start working" />
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <Card.Header><Card.Title>Leads per Agent</Card.Title></Card.Header>
        {leadsPerAgent.length > 0 ? (
          <SafeChart>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsPerAgent} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="agentName" type="category" width={120} {...axisProps} tick={{ fontSize: 10 }} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" fill="#405189" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </SafeChart>
        ) : (
          <EmptyState icon={Target} message="No leads assigned" />
        )}
      </Card>

      <Card>
        <Card.Header><Card.Title>Calls per Agent</Card.Title></Card.Header>
        {callsPerAgent.length > 0 ? (
          <SafeChart>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={callsPerAgent} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="agentName" type="category" width={120} {...axisProps} tick={{ fontSize: 10 }} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" fill="#0ab39c" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </SafeChart>
        ) : (
          <EmptyState icon={Phone} message="No calls made" />
        )}
      </Card>

      <Card className="lg:col-span-2">
        <Card.Header><Card.Title>Agent Leaderboard</Card.Title></Card.Header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--vz-border)] text-xs text-[var(--vz-text-muted)]"><th className="py-2 text-left">#</th><th className="text-left">Agent</th><th>Leads</th><th>Won</th><th>Conversion</th><th>Calls</th><th>Pipeline</th></tr></thead>
            <tbody>{(data?.leaderboard || []).map((agent, index) => <tr key={agent.agentId} className="border-b border-[var(--vz-border)]"><td className="py-3 font-bold">{index + 1}</td><td className="font-semibold">{agent.agentName}</td><td className="text-center">{agent.count}</td><td className="text-center text-success font-bold">{agent.won}</td><td className="text-center">{agent.conversionRate}%</td><td className="text-center">{agent.calls}</td><td className="text-center">₹{(agent.pipelineValue || 0).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function RevenueTab({ data }) {
  const revenueByMonth = data?.revenueByMonth || []
  const hasData = revenueByMonth.length > 0

  return (
    <Card>
      <Card.Header className="flex items-center justify-between">
        <Card.Title>Revenue Performance</Card.Title>
      </Card.Header>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="p-3 rounded-lg bg-success/10"><p className="text-[10px] uppercase text-[var(--vz-text-muted)]">Won Revenue</p><p className="text-lg font-bold text-success">₹{(data?.wonRevenue || 0).toLocaleString()}</p></div>
        <div className="p-3 rounded-lg bg-primary/10"><p className="text-[10px] uppercase text-[var(--vz-text-muted)]">Pipeline Value</p><p className="text-lg font-bold text-primary">₹{(data?.pipelineValue || 0).toLocaleString()}</p></div>
        <div className="p-3 rounded-lg bg-info/10"><p className="text-[10px] uppercase text-[var(--vz-text-muted)]">Deals Closed</p><p className="text-lg font-bold text-info">{data?.dealsClosed || 0}</p></div>
        <div className="p-3 rounded-lg bg-warning/10"><p className="text-[10px] uppercase text-[var(--vz-text-muted)]">Average Deal</p><p className="text-lg font-bold text-warning">₹{(data?.avgDealSize || 0).toLocaleString()}</p></div>
      </div>
      {hasData ? (
        <SafeChart>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vz-border)" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis tickFormatter={(v) => `₹${v / 1000}k`} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="revenue" fill="#405189" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </SafeChart>
      ) : (
        <EmptyState icon={DollarSign} message="No revenue data yet" submessage="Revenue data will appear as deals are closed" />
      )}
    </Card>
  )
}

/* ---------- Main Dashboard ---------- */

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('leads')
  const [dateRange, setDateRange] = useState('30d')
  const { user } = useSelector((s) => s.auth)

  const { data: dashData } = useGetDashboardQuery()
  const { data: leadData } = useGetLeadAnalyticsQuery({ range: dateRange })
  const { data: callData } = useGetCallAnalyticsQuery({ range: dateRange })
  const { data: teamData } = useGetTeamAnalyticsQuery({ range: dateRange })
  const { data: revenueData } = useGetRevenueAnalyticsQuery({ range: dateRange })

  const dash = dashData?.data || {}

  // All stat cards use real API data
  const totalLeads = dash.leads?.total ?? 0
  const totalCalls = dash.calls?.totalToday ?? 0
  const avgScore = Math.round(dash.leads?.avgScore || 0)
  const activeTeam = dash.team?.activeUsers ?? 0

  const tabs = [
    { key: 'leads', label: 'Lead Insights', icon: Target },
    { key: 'calls', label: 'Call Centers', icon: Phone },
    { key: 'team', label: 'Agent Performance', icon: Users },
    { key: 'revenue', label: 'Financials', icon: DollarSign },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h4 className="text-xl font-black text-[var(--vz-heading)]">Analytics Dashboard</h4>
           <p className="text-sm text-[var(--vz-text-muted)] mt-1">Real-time insights from your CRM data</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                className="pl-9 pr-6 py-2 text-sm font-semibold rounded-lg border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer">
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last quarter</option>
                <option value="1y">Full year</option>
              </select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-2">
           <WelcomeWidget name={user?.name?.split(' ')[0] || 'Member'} />
        </div>
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
           <StatCard title="Active Leads" value={totalLeads.toLocaleString()} icon={Target} color="primary" />
           <StatCard title="Active Team" value={activeTeam} icon={Users} color="success" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard title="Calls Today" value={totalCalls.toLocaleString()} icon={Phone} color="info" />
        <StatCard title="Avg. Lead Score" value={avgScore > 0 ? `${avgScore}/100` : '—'} icon={TrendingUp} color="warning" />
        <StatCard title="Messages Today" value={((dash.whatsapp?.sentToday || 0) + (dash.whatsapp?.receivedToday || 0)).toLocaleString()} icon={MousePointer2} color="secondary" />
        <StatCard title="Calls Duration" value={dash.calls?.avgDuration ? `${Math.round(dash.calls.avgDuration)}s avg` : '—'} icon={Phone} color="info" />
      </div>

      <div className="space-y-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="pt-2">
          {activeTab === 'leads' && <LeadsTab data={leadData?.data} />}
          {activeTab === 'calls' && <CallsTab data={callData?.data} />}
          {activeTab === 'team' && <TeamTab data={teamData?.data} />}
          {activeTab === 'revenue' && <RevenueTab data={revenueData?.data} />}
        </div>
      </div>
    </div>
  )
}
