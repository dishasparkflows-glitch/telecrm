import PageHeader from '../components/layout/PageHeader'
import KPICard from '../components/ui/KPICard'
import Card from '../components/ui/Card'

import { useGetDashboardQuery } from '../features/analytics/analyticsApi'
import { useGetLeadStatsQuery } from '../features/leads/leadApi'
import { Target, Users, TrendingUp, Megaphone } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const STAGE_COLORS = {
  new: '#405189', contacted: '#0ab39c', qualified: '#f7b84b',
  negotiation: '#299cdb', won: '#0ab39c', lost: '#f06548',
  proposal: '#8b5cf6', demo: '#ec4899',
}

const SOURCE_COLORS = ['#405189', '#0ab39c', '#f7b84b', '#f06548', '#299cdb', '#8b5cf6', '#ec4899']

const tooltipStyle = {
  backgroundColor: 'var(--vz-card-bg)',
  border: '1px solid var(--vz-border)',
  borderRadius: '6px',
  fontSize: '12px',
}

export default function Dashboard() {
  const { data: dashData, isLoading: dashLoading } = useGetDashboardQuery()
  const { data: leadStatsData, isLoading: statsLoading } = useGetLeadStatsQuery()

  const dash = dashData?.data || {}
  const leadStats = leadStatsData?.data || {}
  const isLoading = dashLoading || statsLoading

  // KPI values — all from API, no static fallback
  const totalLeads = dash.leads?.total || leadStats.totalLeads || 0
  const newLeads = dash.leads?.newToday || 0
  const callsDone = dash.calls?.totalToday || 0
  const whatsappMsgs = (dash.whatsapp?.sentToday || 0) + (dash.whatsapp?.receivedToday || 0)
  const activeTeam = dash.team?.activeUsers || 0

  // Convert stage stats to chart data
  const byStage = leadStats.byStage || {}
  const stageData = Object.entries(byStage)
    .filter(([, count]) => count > 0)
    .map(([stage, count]) => ({
      name: stage.charAt(0).toUpperCase() + stage.slice(1),
      value: count,
      color: STAGE_COLORS[stage] || '#405189',
    }))

  // Convert source stats to chart data
  const bySource = leadStats.bySource || {}
  const sourceData = Object.entries(bySource)
    .filter(([, count]) => count > 0)
    .map(([source, count], i) => ({
      name: source.charAt(0).toUpperCase() + source.slice(1).replace('_', ' '),
      value: count,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }))

  const hasStageData = stageData.length > 0
  const hasSourceData = sourceData.length > 0

  return (
    <>
      <PageHeader
        title="CRM"
        breadcrumbs={[
          { label: 'Dashboards', path: '/dashboard' },
          { label: 'CRM' },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <KPICard title="Total Leads" value={totalLeads} icon={Target} iconColor="primary" />
        <KPICard title="New Leads Today" value={newLeads} icon={Users} iconColor="info" />
        <KPICard title="Calls Done Today" value={callsDone} icon={TrendingUp} iconColor="secondary" />
        <KPICard title="WhatsApp Stats" value={whatsappMsgs} icon={Megaphone} iconColor="warning" />
        <KPICard title="Active Team" value={activeTeam} icon={Users} iconColor="success" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Leads by Stage */}
        <Card>
          <Card.Header><Card.Title>Leads by Stage</Card.Title></Card.Header>
          {isLoading ? (
            <div className="flex items-center justify-center h-[250px] text-[var(--vz-text-muted)] text-sm">Loading...</div>
          ) : hasStageData ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--vz-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--vz-text-muted)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--vz-text-muted)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stageData.map((entry, i) => (
                    <Cell key={`stage-${i}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-[var(--vz-text-muted)]">
              <Target size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No leads yet</p>
              <p className="text-xs mt-1">Create your first lead to see stage distribution</p>
            </div>
          )}
        </Card>

        {/* Leads by Source */}
        <Card>
          <Card.Header><Card.Title>Leads by Source</Card.Title></Card.Header>
          {isLoading ? (
            <div className="flex items-center justify-center h-[250px] text-[var(--vz-text-muted)] text-sm">Loading...</div>
          ) : hasSourceData ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none">
                    {sourceData.map((entry, i) => (
                      <Cell key={`source-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {sourceData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-[var(--vz-text)]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-[var(--vz-text-muted)]">
              <Megaphone size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No source data yet</p>
              <p className="text-xs mt-1">Lead sources will appear as you add leads</p>
            </div>
          )}
        </Card>
      </div>

      {/* Call Stats Summary */}
      <Card>
        <Card.Header><Card.Title>Activity Summary</Card.Title></Card.Header>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--vz-heading)]">{totalLeads}</p>
            <p className="text-xs text-[var(--vz-text-muted)] mt-1">Total Leads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--vz-heading)]">{callsDone}</p>
            <p className="text-xs text-[var(--vz-text-muted)] mt-1">Calls Today</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--vz-heading)]">{whatsappMsgs}</p>
            <p className="text-xs text-[var(--vz-text-muted)] mt-1">Messages Today</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--vz-heading)]">{Math.round(leadStats.avgScore || 0)}</p>
            <p className="text-xs text-[var(--vz-text-muted)] mt-1">Avg Lead Score</p>
          </div>
        </div>
      </Card>
    </>
  )
}
