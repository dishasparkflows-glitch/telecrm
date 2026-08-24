import { useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useGetProfileQuery } from '../../features/tenant/tenantApi'
import { useGetMeQuery } from '../../features/auth/authApi'
import { useUpdateUserMutation } from '../../features/users/userApi'
import { useGetUploadUrlMutation } from '../../features/uploads/uploadApi'
import { useToast } from '../../components/ui/Toast'
import Card from '../../components/ui/Card'
import { ROLES } from '../../utils/constants'
import {
  User, Mail, Phone, Calendar, Briefcase, Shield, Building2,
  Activity, Globe, Award, Edit2, Save, X, ShieldCheck,
  Smartphone, CheckCircle2, Lock, Check
} from 'lucide-react'

// SVG Progress component
const CircularProgress = ({ value }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-32 h-32">
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="#f3f4f6"
          strokeWidth="8"
          fill="transparent"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="#4f46e5"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold text-gray-900">{value}%</span>
      </div>
    </div>
  );
};

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

  const profileCompletion = [
    { label: 'Avatar', done: !!(user?.contact?.avatar) },
    { label: 'Email Verified', done: !!user?.authentication?.isEmailVerified },
    { label: 'Phone Added', done: !!(user?.contact?.phone) },
    { label: '2FA Enabled', done: !!user?.twoFactor?.enabled },
  ]
  const completedCount = profileCompletion.filter(i => i.done).length
  const completionPercentage = Math.round((completedCount / profileCompletion.length) * 100)

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-0 shadow-sm overflow-hidden relative bg-white">
        {/* Decorative background shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-[0.03]">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600 blur-3xl"></div>
          <div className="absolute top-20 right-20 w-80 h-80 rounded-full bg-indigo-600 blur-3xl"></div>
        </div>

        <div className="px-6 pt-6 relative z-10 flex flex-col md:flex-row md:items-start gap-6">
          {/* Avatar Section */}
          <div className="relative shrink-0">
            <div className="w-[120px] h-[120px] rounded-full border-4 border-indigo-50 shadow-sm bg-gradient-to-br from-indigo-100 to-purple-50 flex items-center justify-center text-indigo-700 text-4xl font-bold overflow-hidden p-1">
               <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center border-2 border-white">
                 {(user?.contact?.avatar) ? (
                  <img src={user.contact.avatar} alt="Profile" className="w-full h-full object-cover" />
                 ) : (
                  user?.contact?.name?.[0] || 'A'
                 )}
               </div>
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
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-md border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <Edit2 size={14} />
            </button>
          </div>

          {/* Info Section */}
          <div className="flex-1 space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.contact?.name || 'Admin User'}
              </h1>
              <CheckCircle2 className="w-6 h-6 text-blue-600 fill-blue-50" />
            </div>
            
            <div className="flex items-center gap-2">
               <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                 {user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'Team Member'}
               </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-y-2 gap-x-6 text-sm text-gray-600 mt-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {user?.contact?.email || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                {user?.contact?.phone || 'Not added'}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-y-2 gap-x-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                {activeBranch?.name || 'Head Office'}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                Joined {joinDate}
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="flex items-center gap-4 shrink-0 pt-2">
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm min-w-[140px]">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{branches?.length || 1}</div>
                <div className="text-xs font-medium text-gray-500 mt-1">Branches</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm min-w-[140px]">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{tenant.pipelineStages?.length || 7}</div>
                <div className="text-xs font-medium text-gray-500 mt-1">Stages</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm min-w-[140px]">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{user?.role === ROLES.SUPER_ADMIN ? 'Full' : 'Limited'}</div>
                <div className="text-xs font-medium text-gray-500 mt-1">Access Level</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-6 mt-6 border-t border-gray-100">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors
                ${activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Profile Completion */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="pb-4 border-b border-gray-50 mb-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <Card.Title className="text-gray-900 font-bold">Profile Completion</Card.Title>
                </div>
                <span className="text-xl">🎉</span>
              </div>
            </Card.Header>
            <div className="flex items-center gap-6 px-4 pb-4">
              <div className="flex flex-col items-center w-1/2">
                <CircularProgress value={completionPercentage} />
                <p className="text-xs text-gray-500 text-center mt-4 px-4 leading-relaxed">
                  Keep going! Complete your profile to unlock full potential.
                </p>
              </div>
              <div className="w-1/2 space-y-4 border-l border-gray-100 pl-8 py-2">
                {profileCompletion.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border
                      ${item.done ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-50 border-gray-200 text-transparent'}`}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span className={`text-sm font-medium ${item.done ? 'text-gray-900' : 'text-gray-500'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="pb-4 border-b border-gray-50 mb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <Card.Title className="text-gray-900 font-bold">About</Card.Title>
              </div>
            </Card.Header>
            <div className="space-y-4 px-4 pb-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Managing data with SparkCRM. As a {user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'team member'},
                {user?.role === ROLES.SUPER_ADMIN
                  ? ' overseeing all branches, users, and business operations.'
                  : ' contributing to lead management, customer communications, and team collaboration.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {[
                  { icon: Globe, label: 'Timezone', value: tenant.timezone || 'IST', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { icon: CheckCircle2, label: 'Status', value: user?.isActive ? 'Active' : 'Inactive', color: 'text-green-600', bg: 'bg-green-50', valColor: 'text-green-600' },
                  { icon: Award, label: 'Plan', value: tenant.planId?.name || 'Trial', color: 'text-purple-600', bg: 'bg-purple-50', valColor: 'text-purple-600' },
                  { icon: Activity, label: 'Last Login', value: 'Online', color: 'text-blue-600', bg: 'bg-blue-50', valColor: 'text-green-600', dot: true },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                    <div className={`w-8 h-8 rounded-full ${s.bg} flex items-center justify-center mb-2`}>
                      <s.icon size={14} className={s.color} />
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                    <div className="flex items-center gap-1.5">
                      {s.dot && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                      <p className={`text-sm font-bold ${s.valColor || 'text-gray-900'}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Personal Information */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="pb-4 border-b border-gray-50 mb-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  <Card.Title className="text-gray-900 font-bold">Personal Information</Card.Title>
                </div>
                {!isEditingProfile ? (
                  <button onClick={handleStartEdit} className="text-indigo-600 hover:text-indigo-700 p-1 bg-indigo-50 rounded-md">
                    <Edit2 size={16} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile} className="text-gray-500 hover:bg-gray-100 p-1 rounded-md">
                      <X size={16} />
                    </button>
                    <button onClick={handleSaveProfile} disabled={isSavingProfile} className="text-green-600 hover:bg-green-50 p-1 rounded-md">
                      <Save size={16} />
                    </button>
                  </div>
                )}
              </div>
            </Card.Header>
            <div className="space-y-4 px-4 pb-4">
              {!isEditingProfile ? (
                <>
                  {[
                    { icon: User, label: 'Full Name', value: user?.contact?.name || 'N/A' },
                    { icon: Mail, label: 'Email', value: user?.contact?.email || 'N/A' },
                    { icon: Phone, label: 'Phone', value: user?.contact?.phone || 'Not added' },
                    { icon: Smartphone, label: 'Mobile (Full No.)', value: user?.contact?.mobileNumber || 'Not added' },
                    { icon: Shield, label: 'Role', value: user?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : user?.roleName || user?.role || 'Agent', badge: true },
                    { icon: Building2, label: 'Branch', value: activeBranch?.name || 'Head Office' },
                    { icon: Briefcase, label: 'Company', value: tenant.company?.name || 'N/A' },
                    { icon: Calendar, label: 'Joined On', value: joinDate },
                  ].map((item) => (
                    <div key={item.label} className="grid grid-cols-2 gap-4 items-center">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <item.icon size={14} className="text-gray-400" />
                        {item.label}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.badge ? (
                          <span className="text-indigo-600">{item.value}</span>
                        ) : (
                          <span>{item.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phone</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Mobile (For Calling)</label>
                    <input
                      type="text"
                      value={profileForm.mobileNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, mobileNumber: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Account Security */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="pb-4 border-b border-gray-50 mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                <Card.Title className="text-gray-900 font-bold">Account Security</Card.Title>
              </div>
            </Card.Header>
            <div className="space-y-3 px-4 pb-4">
              {[
                { 
                  icon: Mail, 
                  iconBg: 'bg-purple-50', 
                  iconColor: 'text-purple-600',
                  label: 'Email Verification', 
                  desc: user?.authentication?.isEmailVerified ? 'Your email is verified' : 'Please verify your email', 
                  badge: user?.authentication?.isEmailVerified ? 'Verified' : 'Pending',
                  badgeColor: user?.authentication?.isEmailVerified ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
                },
                { 
                  icon: ShieldCheck, 
                  iconBg: 'bg-orange-50', 
                  iconColor: 'text-orange-600',
                  label: 'Two-Factor Authentication', 
                  desc: 'Add an extra layer of security', 
                  badge: user?.twoFactor?.enabled ? 'Enabled' : 'Disabled',
                  badgeColor: user?.twoFactor?.enabled ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                },
                { 
                  icon: Lock, 
                  iconBg: 'bg-indigo-50', 
                  iconColor: 'text-indigo-600',
                  label: 'Password', 
                  desc: `Last changed on ${joinDate}`, 
                  badge: 'Change',
                  badgeColor: 'bg-indigo-50 text-indigo-600 cursor-pointer hover:bg-indigo-100 transition-colors'
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-100 transition-colors bg-white shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center shrink-0`}>
                      <item.icon size={18} className={item.iconColor} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-semibold ${item.badgeColor}`}>
                    {item.badge}
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      )}

      {activeTab === 'activities' && (
        <Card className="border-0 shadow-sm">
          <div className="text-center py-12">
            <Activity size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Activity Log</h3>
            <p className="text-sm text-gray-500">Activity tracking will be available soon</p>
          </div>
        </Card>
      )}
    </div>
  )
}
