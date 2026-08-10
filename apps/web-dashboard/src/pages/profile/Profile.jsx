import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useGetProfileQuery } from '../../features/tenant/tenantApi'
import { useGetMeQuery } from '../../features/auth/authApi'
import { useUpdateUserMutation } from '../../features/users/userApi'
import { useGetUploadUrlMutation } from '../../features/uploads/uploadApi'
import { useToast } from '../../components/ui/Toast'
import { useRef } from 'react'
import Card from '../../components/ui/Card'
import { ROLES } from '../../utils/constants'
import Badge from '../../components/ui/Badge'
import {
  User, Mail, Phone, Calendar, Briefcase, Shield, Building2,
  Activity, Globe, Award, Camera, Edit2, Save, X
} from 'lucide-react'
import Button from '../../components/ui/Button'

export default function Profile() {
  const { user, branches, activeBranchId } = useSelector((s) => s.auth)
  const { data: profileData } = useGetProfileQuery()
  const { refetch: refetchMe } = useGetMeQuery()
  const [updateUser] = useUpdateUserMutation()
  const [getUploadUrl] = useGetUploadUrlMutation()
  const fileInputRef = useRef(null)
  const toast = useToast()

  const tenant = profileData?.data || {}
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', mobileNumber: '' })
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const handleStartEdit = () => {
    setProfileForm({
      name: user?.contact?.name || '',
      phone: user?.contact?.phone || '',
      mobileNumber: user?.contact?.mobileNumber || '',
    })
    setIsEditingProfile(true)
  }

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    try {
      await updateUser({
        id: user._id,
        contact: {
          ...user.contact,
          name: profileForm.name,
          phone: profileForm.phone,
          mobileNumber: profileForm.mobileNumber,
        }
      }).unwrap()
      toast('Profile updated successfully', 'success')
      setIsEditingProfile(false)
      refetchMe()
    } catch (err) {
      toast(err?.data?.message || 'Failed to update profile', 'error')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const activeBranch = branches?.find(b => b._id === activeBranchId)
  const joinDate = user?.meta?.createdAt ? new Date(user.meta?.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const res = await getUploadUrl({ 
        uploadType: 'avatar',
        fileType: file.type,
        fileSize: file.size
      }).unwrap()
      const { uploadUrl, key } = res.data

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      })

      // Update the user profile with the new avatar key
      await updateUser({ id: user._id, contact: { avatar: key }, avatar: key }).unwrap()
      toast('Profile photo updated successfully', 'success')
      refetchMe()
    } catch (err) {
      toast('Failed to upload image', 'error')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

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
              <div className="w-[120px] h-[120px] rounded-full border-4 border-[var(--vz-card-bg)] shadow-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
                {(user?.contact?.avatar) ? (
                  <img src={user?.contact?.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.contact?.name?.[0] || 'A'
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/jpeg, image/png, image/webp" 
                onChange={handleAvatarUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 md:pb-1">
              <h4 className="text-xl font-bold text-[var(--vz-heading)]">
                {user?.contact?.name || 'Admin User'}
              </h4>
              <p className="text-sm text-[var(--vz-text-muted)] mt-0.5">
                {user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'Team Member'} at {tenant.company?.name || 'SparkCRM'}
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
                      { label: 'Avatar', done: !!(user?.contact?.avatar) },
                      { label: 'Email Verified', done: !!user?.authentication?.isEmailVerified },
                      { label: 'Phone Added', done: !!(user?.contact?.phone) },
                      { label: '2FA Enabled', done: !!user?.twoFactor?.enabled },
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
                  <div className="flex items-center justify-between w-full">
                    <Card.Title>Personal Information</Card.Title>
                    {!isEditingProfile ? (
                      <button onClick={handleStartEdit} className="text-primary hover:text-indigo-600 p-1">
                        <Edit2 size={16} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile} className="text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] p-1">
                          <X size={16} />
                        </button>
                        <button onClick={handleSaveProfile} disabled={isSavingProfile} className="text-success hover:text-green-600 p-1">
                          <Save size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </Card.Header>
                <div className="space-y-3.5">
                  {!isEditingProfile ? (
                    <>
                      {[
                        { icon: User, label: 'Full Name', value: user?.contact?.name || 'N/A' },
                        { icon: Mail, label: 'Email', value: user?.contact?.email || 'N/A' },
                        { icon: Phone, label: 'Phone', value: user?.contact?.phone || 'Not added' },
                        { icon: Phone, label: 'Mobile (Calling)', value: user?.contact?.mobileNumber || 'Not added' },
                        { icon: Shield, label: 'Role', value: user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'Agent', badge: true },
                        { icon: Building2, label: 'Branch', value: activeBranch?.name || 'Head Office' },
                        { icon: Briefcase, label: 'Company', value: tenant.company?.name || 'N/A' },
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
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-[var(--vz-text-muted)] mb-1">Full Name</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          className="w-full bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-md px-3 py-1.5 text-sm text-[var(--vz-text)] focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--vz-text-muted)] mb-1">Phone</label>
                        <input
                          type="text"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          className="w-full bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-md px-3 py-1.5 text-sm text-[var(--vz-text)] focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--vz-text-muted)] mb-1">Mobile (For Calling)</label>
                        <input
                          type="text"
                          value={profileForm.mobileNumber}
                          onChange={(e) => setProfileForm({ ...profileForm, mobileNumber: e.target.value })}
                          className="w-full bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-md px-3 py-1.5 text-sm text-[var(--vz-text)] focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>
                  )}
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
                    Managing {tenant.company?.name || 'the organization'} with SparkCRM. As a {user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'team member'},
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
                    { label: 'Email Verification', desc: user?.authentication?.isEmailVerified ? 'Your email is verified' : 'Please verify your email', status: !!user?.authentication?.isEmailVerified, badge: user?.authentication?.isEmailVerified ? 'Verified' : 'Pending' },
                    { label: 'Two-Factor Authentication', desc: user?.twoFactor?.enabled ? '2FA is enabled for extra security' : 'Add an extra layer of security', status: !!user?.twoFactor?.enabled, badge: user?.twoFactor?.enabled ? 'Enabled' : 'Disabled' },
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
