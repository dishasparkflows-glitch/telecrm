import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Phone, MessageSquare, Mail, CalendarDays, CheckCircle, Clock, Search, Filter } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { useGetFollowUpsQuery, useGetFollowUpStatsQuery } from '../../features/leads/followUpApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
import { useSelector } from 'react-redux'

const FollowUpsList = () => {
    const navigate = useNavigate()
    const { activeBranchId } = useSelector(state => state.auth)
    const { data: usersData } = useGetAllUsersListQuery({ branchId: activeBranchId })
    const users = usersData?.data || []

    const [filters, setFilters] = useState({
        status: 'upcoming',
        type: '',
        assignedUserId: ''
    })

    const { data: statsData } = useGetFollowUpStatsQuery()
    const { data: followUpsData, isLoading } = useGetFollowUpsQuery({ 
        ...filters,
        limit: 100
    })

    const stats = statsData?.data || { today: 0, upcoming: 0, missed: 0, completedToday: 0 }
    const followUps = followUpsData?.data || []

    const getIcon = (type) => {
        switch (type) {
            case 'call': return <Phone size={14} className="text-primary" />
            case 'whatsapp': return <MessageSquare size={14} className="text-success" />
            case 'email': return <Mail size={14} className="text-info" />
            default: return <CalendarDays size={14} className="text-secondary" />
        }
    }

    const getStatusColor = (status, date) => {
        if (status === 'completed') return 'success'
        if (status === 'cancelled') return 'danger'
        if (status === 'scheduled') {
            if (new Date(date) < new Date(Date.now() - 30 * 60000)) return 'danger' // missed
            if (new Date(date).toDateString() === new Date().toDateString()) return 'warning' // today
            return 'primary'
        }
        return 'secondary'
    }

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Follow-ups"
                breadcrumbs={[
                    { label: 'CRM', path: '/dashboard' },
                    { label: 'Follow-ups' }
                ]}
            />

            {/* Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="hover:border-warning/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, status: 'scheduled' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">Today's Follow-ups</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.today}</h4>
                        </div>
                        <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center text-warning">
                            <Clock size={24} />
                        </div>
                    </div>
                </Card>
                
                <Card className="hover:border-primary/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, status: 'upcoming' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">Upcoming</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.upcoming}</h4>
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <Calendar size={24} />
                        </div>
                    </div>
                </Card>
                
                <Card className="hover:border-danger/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, status: 'missed' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">Missed</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.missed}</h4>
                        </div>
                        <div className="w-12 h-12 bg-danger/10 rounded-lg flex items-center justify-center text-danger">
                            <Clock size={24} />
                        </div>
                    </div>
                </Card>
                
                <Card className="hover:border-success/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, status: 'completed' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">Completed Today</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.completedToday}</h4>
                        </div>
                        <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center text-success">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                    <div className="flex-1 w-full relative">
                        <Input 
                            placeholder="Search notes..." 
                            className="pl-9"
                        />
                        <Search className="w-4 h-4 text-[var(--vz-text-muted)] absolute left-3 top-3" />
                    </div>
                    
                    <Select
                        className="w-full sm:w-48"
                        value={filters.status}
                        onChange={(val) => setFilters({ ...filters, status: val })}
                        options={[
                            { value: 'upcoming', label: 'Upcoming' },
                            { value: 'missed', label: 'Missed' },
                            { value: 'completed', label: 'Completed' },
                            { value: 'scheduled', label: 'Scheduled (All)' },
                            { value: 'cancelled', label: 'Cancelled' },
                        ]}
                    />

                    <Select
                        className="w-full sm:w-48"
                        value={filters.type}
                        onChange={(val) => setFilters({ ...filters, type: val })}
                        options={[
                            { value: '', label: 'All Types' },
                            { value: 'call', label: 'Call' },
                            { value: 'whatsapp', label: 'WhatsApp' },
                            { value: 'email', label: 'Email' },
                            { value: 'other', label: 'Other' },
                        ]}
                    />

                    <Select
                        className="w-full sm:w-48"
                        value={filters.assignedUserId}
                        onChange={(val) => setFilters({ ...filters, assignedUserId: val })}
                        options={[
                            { value: '', label: 'All Users' },
                            ...users.map(u => ({ value: u._id, label: u.name }))
                        ]}
                    />
                </div>

                {isLoading ? (
                    <div className="space-y-4 animate-pulse">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-100 dark:bg-[var(--vz-border)] rounded-lg"></div>
                        ))}
                    </div>
                ) : followUps.length > 0 ? (
                    <div className="border border-[var(--vz-border)] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-[var(--vz-bg-body)] border-b border-[var(--vz-border)] text-xs font-semibold text-[var(--vz-text-muted)] uppercase tracking-wider">
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Scheduled Date</th>
                                        <th className="px-4 py-3">Lead Note</th>
                                        <th className="px-4 py-3">Assigned User</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--vz-border)]">
                                    {followUps.map(f => (
                                        <tr key={f._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2 capitalize">
                                                    {getIcon(f.type)}
                                                    <span className="font-medium text-[var(--vz-heading)]">{f.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-semibold text-[var(--vz-heading)]">
                                                    {new Date(f.scheduledAt).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-[var(--vz-text-muted)]">
                                                    {new Date(f.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="line-clamp-2 text-[var(--vz-text)]" title={f.note}>
                                                    {f.note || <span className="text-[var(--vz-text-muted)] italic">No notes</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="text-[var(--vz-text)]">{f.assignedUser?.name || 'Unknown'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <Badge color={getStatusColor(f.status, f.scheduledAt)} className="capitalize">
                                                    {f.status === 'scheduled' && new Date(f.scheduledAt) < new Date(Date.now() - 30 * 60000) ? 'Missed' : f.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <Button size="sm" variant="soft-primary" onClick={() => navigate(`/leads/${f.leadId}`)}>
                                                    View Lead
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <EmptyState 
                        icon={Calendar}
                        title="No Follow-ups Found"
                        description="There are no follow-ups matching your current filters."
                    />
                )}
            </Card>
        </div>
    )
}

export default FollowUpsList
