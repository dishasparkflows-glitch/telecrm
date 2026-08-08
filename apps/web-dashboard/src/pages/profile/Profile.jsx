import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useGetProfileQuery } from '../../features/tenant/tenantApi'
import Card from '../../components/ui/Card'
import { ROLES } from '../../utils/constants'
import Badge from '../../components/ui/Badge'
import {
  User, Mail, Phone, Calendar, Briefcase, Shield, Building2,
  Activity, Globe, Award, Camera
} from 'lucide-react'

export default function Profile() {
  const { user, branches, activeBranchId } = useSelector((s) => s.auth)
  const { data: profileData } = useGetProfileQuery()
  const tenant = profileData?.data || {}
  const [activeTab, setActiveTab] = useState('overview')

  const activeBranch = branches?.find(b => b._id === activeBranchId)
  const joinDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'
  const lastLogin = user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Just now'

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'activities', label: 'Activities' },
  ]

  return (
    <div className="-m-6">
      {/* Cover Banner */}
      <div className="relative h-[260px] bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-500 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}/>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Profile Header Card */}
      <div className="px-6 -mt-[90px] relative z-10">
        <Card className="overflow-visible">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 pb-4">
            {/* Avatar */}
            <div className="relative -mt-[60px] ml-2">
              <div className="w-[120px] h-[120px] rounded-full border-4 border-[var(--vz-card-bg)] shadow-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-4xl font-bold">
                {user?.name?.[0] || user?.firstName?.[0] || 'A'}
              </div>
              <button className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors">
                <Camera size={14} />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 md:pb-1">
              <h4 className="text-xl font-bold text-[var(--vz-heading)]">
                {user?.name || user?.firstName || 'Admin User'}
              </h4>
              <p className="text-sm text-[var(--vz-text-muted)] mt-0.5">
                {user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'Team Member'} at {tenant.companyName || 'SparkCRM'}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mr-4 pb-1">
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--vz-heading)]">{branches?.length || 1}</p>
                <p className="text-xs text-[var(--vz-text-muted)]">Branches</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--vz-heading)]">{tenant.pipelineStages?.length || 7}</p>
                <p className="text-xs text-[var(--vz-text-muted)]">Stages</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{user?.role === ROLES.SUPER_ADMIN ? 'Full' : 'Limited'}</p>
                <p className="text-xs text-[var(--vz-text-muted)]">Access</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-[var(--vz-border)] -mx-4 px-4 pt-0">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)]'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Content */}
      <div className="px-6 pb-6 mt-4">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Complete Your Profile */}
              <Card>
                <Card.Header>
                  <Card.Title>Complete Your Profile</Card.Title>
                </Card.Header>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--vz-text)]">Profile Completion</span>
                    <span className="text-sm font-bold text-primary">70%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--vz-input-bg)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500" style={{ width: '70%' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { label: 'Avatar', done: false },
                      { label: 'Email Verified', done: user?.isEmailVerified },
                      { label: 'Phone Added', done: !!user?.phone },
                      { label: '2FA Enabled', done: user?.twoFactorEnabled },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5 text-xs">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold
                          ${item.done ? 'bg-secondary text-white' : 'bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)]'}`}>
                          {item.done ? '✓' : ''}
                        </div>
                        <span className={item.done ? 'text-[var(--vz-heading)]' : 'text-[var(--vz-text-muted)]'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Personal Information */}
              <Card>
                <Card.Header>
                  <Card.Title>Personal Information</Card.Title>
                </Card.Header>
                <div className="space-y-3.5">
                  {[
                    { icon: User, label: 'Full Name', value: user?.name || user?.firstName || 'N/A' },
                    { icon: Mail, label: 'Email', value: user?.email || 'N/A' },
                    { icon: Phone, label: 'Phone', value: user?.phone || 'Not added' },
                    { icon: Shield, label: 'Role', value: user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'Agent', badge: true },
                    { icon: Building2, label: 'Branch', value: activeBranch?.name || 'Head Office' },
                    { icon: Briefcase, label: 'Company', value: tenant.companyName || 'N/A' },
                    { icon: Calendar, label: 'Joined', value: joinDate },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon size={15} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-[var(--vz-text-muted)] uppercase tracking-wide">{item.label}</p>
                        {item.badge ? (
                          <Badge color="primary" className="mt-0.5">{item.value}</Badge>
                        ) : (
                          <p className="text-sm text-[var(--vz-heading)] truncate">{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* About */}
              <Card>
                <Card.Header>
                  <Card.Title>About</Card.Title>
                </Card.Header>
                <div className="space-y-3">
                  <p className="text-sm text-[var(--vz-text)] leading-relaxed">
                    Managing {tenant.companyName || 'the organization'} with SparkCRM. As a {user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'team member'},
                    {user?.role === ROLES.SUPER_ADMIN
                      ? ' overseeing all branches, users, and business operations. Full access to roles, permissions, modules, and all CRM features.'
                      : ' contributing to lead management, customer communications, and team collaboration.'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {[
                      { icon: Globe, label: 'Timezone', value: tenant.timezone || 'IST' },
                      { icon: Shield, label: 'Status', value: user?.isActive ? 'Active' : 'Inactive' },
                      { icon: Award, label: 'Plan', value: tenant.planId?.name || 'Trial' },
                      { icon: Activity, label: 'Last Login', value: 'Online' },
                    ].map((s) => (
                      <div key={s.label} className="p-3 rounded-lg bg-[var(--vz-input-bg)]">
                        <s.icon size={16} className="text-primary mb-1.5" />
                        <p className="text-xs text-[var(--vz-text-muted)]">{s.label}</p>
                        <p className="text-sm font-semibold text-[var(--vz-heading)]">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Account Security */}
              <Card>
                <Card.Header>
                  <Card.Title>Account Security</Card.Title>
                </Card.Header>
                <div className="space-y-3">
                  {[
                    { label: 'Email Verification', desc: user?.isEmailVerified ? 'Your email is verified' : 'Please verify your email', status: user?.isEmailVerified, badge: user?.isEmailVerified ? 'Verified' : 'Pending' },
                    { label: 'Two-Factor Authentication', desc: user?.twoFactorEnabled ? '2FA is enabled for extra security' : 'Add an extra layer of security', status: user?.twoFactorEnabled, badge: user?.twoFactorEnabled ? 'Enabled' : 'Disabled' },
                    { label: 'Password', desc: 'Last changed on registration', status: true, badge: 'Set' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-[var(--vz-border)] hover:border-primary/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-[var(--vz-heading)]">{item.label}</p>
                        <p className="text-xs text-[var(--vz-text-muted)]">{item.desc}</p>
                      </div>
                      <Badge color={item.status ? 'success' : 'warning'}>{item.badge}</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recent Activity */}
              <Card>
                <Card.Header>
                  <Card.Title>Recent Activity</Card.Title>
                </Card.Header>
                <div className="relative">
                  <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-[var(--vz-border)]" />
                  <div className="space-y-4">
                    {[
                      { icon: User, color: 'primary', text: 'Registered on SparkCRM', time: joinDate },
                      { icon: Building2, color: 'success', text: `Branch "${activeBranch?.name || 'Head Office'}" created`, time: joinDate },
                      { icon: Shield, color: 'warning', text: 'Default roles and permissions configured', time: joinDate },
                      { icon: Activity, color: 'info', text: 'Last login recorded', time: lastLogin },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3 relative">
                        <div className={`w-[30px] h-[30px] rounded-full bg-${item.color}/10 border-2 border-[var(--vz-card-bg)] flex items-center justify-center z-10 shrink-0`}>
                          <item.icon size={12} className={`text-${item.color}`} />
                        </div>
                        <div className="pb-1">
                          <p className="text-sm text-[var(--vz-heading)]">{item.text}</p>
                          <p className="text-[11px] text-[var(--vz-text-muted)]">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <Card>
            <Card.Header>
              <Card.Title>Activity Log</Card.Title>
            </Card.Header>
            <div className="text-center py-8">
              <Activity size={40} className="text-[var(--vz-text-muted)] mx-auto mb-3 opacity-50" />
              <p className="text-sm text-[var(--vz-text-muted)]">Activity tracking will be available soon</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
