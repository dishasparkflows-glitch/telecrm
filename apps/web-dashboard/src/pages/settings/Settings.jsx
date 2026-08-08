import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { ROLES } from '../../utils/constants'
import {
  useGetProfileQuery,
  useUpdateSettingsMutation,
  useUpdatePipelineMutation,
  useGetReferralCodeQuery,
  useGetReferralStatsQuery,
} from '../../features/tenant/tenantApi'
import { useGetUploadUrlMutation } from '../../features/uploads/uploadApi'
import {
  useListUsersQuery,
  useInviteUserMutation,
  useUpdateUserMutation
} from '../../features/users/userApi'
import { useListRolesQuery } from '../../features/roles/roleApi'
import { useListBranchesQuery } from '../../features/branches/branchApi'
import {
  useGetAssignmentPolicyQuery,
  useSaveAssignmentPolicyMutation,
  useLazyGetMetaOAuthUrlQuery,
  useGetLeadSourceConnectionsQuery,
  useSaveLeadSourceConnectionMutation,
  useCreateLeadSourceApiConnectionMutation,
  useRotateLeadSourceApiKeyMutation,
  useTestLeadSourceConnectionMutation,
  useGetMetaPagesQuery,
  useGetMetaLeadFormsQuery,
  useSubscribeMetaPageMutation,
  useGetLeadSourceEventsQuery,
  useReplayLeadSourceEventMutation,
  useGetLeadSourceMappingsQuery,
  useSaveLeadSourceMappingMutation,
  useGetMetaWebhookConfigQuery,
} from '../../features/leads/leadApi'
import { 
  useGetCustomFieldsQuery, 
  useCreateCustomFieldMutation, 
  useDeleteCustomFieldMutation 
} from '../../features/custom-fields/customFieldApi'
import {
  useGetProvidersQuery,
  useGetIntegrationsQuery,
  useSaveIntegrationMutation,
  useDeleteIntegrationMutation,
  useTestIntegrationMutation,
} from '../../features/integrations/integrationApi'
import {
  useGetWhatsAppConfigQuery,
  useGetTemplatesQuery,
  useSaveWhatsAppConfigMutation,
  useTestWhatsAppConfigMutation,
  useDeleteWhatsAppConfigMutation,
  useManagePhonePoolMutation,
} from '../../features/whatsapp/whatsappApi'
import { 
  useUpdatePasswordMutation, 
  useDisable2FAMutation,
  useGetTrustedDevicesQuery,
  useRevokeTrustedDeviceMutation,
  useRevokeAllTrustedDevicesMutation
} from '../../features/auth/authApi'
import TwoFactorSetupModal from './TwoFactorSetupModal'

import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import {
  Building2,
  GitBranch,
  Database,
  Users,
  Gift,
  Plus,
  Trash2,
  Copy,
  Mail,
  Clock,
  Briefcase,
  Camera,

  LayoutGrid,
  Lock,
  Smartphone,
  CheckCircle2,
  Loader2,
  Edit3,
  Plug,
  Phone,
  PhoneCall,
  MessageCircle,

  CreditCard,
  Cloud,
  Eye,
  EyeOff,
  TestTube2,
  Save,
  ExternalLink,
  Info,

  WifiOff,
  QrCode,
  Users2,
  Hash,
  UserCheck,
  AlertTriangle,
  Shuffle,
  Megaphone,
  X,
  RefreshCw
} from 'lucide-react'

// Tab Item Component for Vertical Sidebar
const TabItem = ({ icon: Icon, label, active, onClick, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg ${
      active
        ? 'bg-primary/10 text-primary border-l-4 border-primary'
        : 'text-[var(--vz-text-muted)] hover:bg-[var(--vz-body-bg)] hover:text-[var(--vz-heading)]'
    }`}
  >
    <div className="flex items-center gap-3">
      <Icon size={18} className={active ? 'text-primary' : 'text-[var(--vz-text-muted)]'} />
      {label}
    </div>
    {count !== undefined && (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-primary text-white' : 'bg-[var(--vz-border)] text-[var(--vz-text-muted)]'}`}>
        {count}
      </span>
    )}
  </button>
)

export default function Settings() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('company')
  const { user: currentUser, activeBranchId } = useSelector((s) => s.auth)
  const [show2FAModal, setShow2FAModal] = useState(false)
  const fileInputRef = useRef(null)

  // Queries
  const { data: profileData, refetch: refetchProfile } = useGetProfileQuery()
  const { data: usersResp, isLoading: usersLoading } = useListUsersQuery({ branchId: activeBranchId })
  const { data: rolesResp } = useListRolesQuery()
  const { data: branchesResp } = useListBranchesQuery()
  const { data: referralData } = useGetReferralCodeQuery()
  const { data: refStatsData } = useGetReferralStatsQuery()
  const { data: assignmentPolicyResp } = useGetAssignmentPolicyQuery({ branchId: activeBranchId })
  const { data: leadSourceConnectionsResp } = useGetLeadSourceConnectionsQuery()
  const { data: leadSourceMappingsResp } = useGetLeadSourceMappingsQuery()
  const { data: metaWebhookConfigResp } = useGetMetaWebhookConfigQuery()
  const { data: whatsappTemplatesResp } = useGetTemplatesQuery()

  // Mutations
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation()
  const [getUploadUrl, { isLoading: isUploadingLogo }] = useGetUploadUrlMutation()
  const [updatePipeline, { isLoading: savingPipeline }] = useUpdatePipelineMutation()
  const [updatePassword, { isLoading: updatingPassword }] = useUpdatePasswordMutation()
  const [disable2FA, { isLoading: disabling2FA }] = useDisable2FAMutation()
  
  const { data: trustedDevicesResp, isLoading: trustedDevicesLoading } = useGetTrustedDevicesQuery(undefined, { skip: activeTab !== 'security' })
  const [revokeTrustedDevice] = useRevokeTrustedDeviceMutation()
  const [revokeAllTrustedDevices, { isLoading: revokingAllDevices }] = useRevokeAllTrustedDevicesMutation()
  
  const { data: customFieldsResp, isLoading: fieldsLoading } = useGetCustomFieldsQuery()
  const [createCustomField] = useCreateCustomFieldMutation()
  const [deleteCustomField] = useDeleteCustomFieldMutation()
  const [inviteUser, { isLoading: inviting }] = useInviteUserMutation()
  const [updateUser, { isLoading: updatingUser }] = useUpdateUserMutation()
  const [saveAssignmentPolicy, { isLoading: savingAssignment }] = useSaveAssignmentPolicyMutation()
  const [getMetaOAuthUrl, { isFetching: startingMetaOAuth }] = useLazyGetMetaOAuthUrlQuery()
  const [saveLeadSourceConnection, { isLoading: savingLeadSourceConnection }] = useSaveLeadSourceConnectionMutation()
  const [createLeadSourceApiConnection, { isLoading: creatingLeadSourceApi }] = useCreateLeadSourceApiConnectionMutation()
  const [rotateLeadSourceApiKey] = useRotateLeadSourceApiKeyMutation()
  const [testLeadSourceConnection, { isLoading: testingLeadSourceConnection }] = useTestLeadSourceConnectionMutation()
  const [subscribeMetaPage, { isLoading: subscribingMetaPage }] = useSubscribeMetaPageMutation()
  const [replayLeadSourceEvent, { isLoading: replayingLeadSourceEvent }] = useReplayLeadSourceEventMutation()
  const [saveLeadSourceMapping, { isLoading: savingLeadSourceMapping }] = useSaveLeadSourceMappingMutation()

  const profile = profileData?.data || {}
  const users = usersResp?.data || []
  const roles = rolesResp?.data || []
  const branches = branchesResp?.data || []
  const referralCode = referralData?.data?.code || ''
  const refStats = refStatsData?.data || {}

  // Forms
  const [companyForm, setCompanyForm] = useState({
    companyName: '',
    email: '',
    phone: '',
    address: '',
    timezone: 'Asia/Kolkata',
    website: ''
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    role: 'agent', 
    roleId: '', 
    branchId: activeBranchId || '',
    password: '',
    customFields: {}
  })
  const [showEditUser, setShowEditUser] = useState(false)
  const [editUserForm, setEditUserForm] = useState(null)
  const [showAddField, setShowAddField] = useState(false)
  const [fieldForm, setFieldForm] = useState({ name: '', type: 'text', required: false, entity: 'Lead' })
  const [fieldFilter, setFieldFilter] = useState('Lead')
  const [pipelineDraft, setPipelineDraft] = useState([])
  const [assignmentForm, setAssignmentForm] = useState({
    strategy: 'manual',
    isActive: true,
    agentIds: [],
  })
  const [leadSourceConnectionForm, setLeadSourceConnectionForm] = useState({
    label: 'Meta Lead Ads',
    externalAccountId: '',
    externalAccountName: '',
    accessToken: '',
    isActive: true,
  })
  const [leadSourceMappingForm, setLeadSourceMappingForm] = useState({
    connectionId: '',
    externalPageId: '',
    externalPageName: '',
    externalFormId: '',
    externalFormName: '',
    source: 'facebook',
    defaultAssignedTo: '',
    sendWelcomeMessage: false,
    welcomeTemplateName: '',
    requireWhatsappConsent: true,
    fieldMapping: { whatsappConsent: 'whatsapp_opt_in' },
    isActive: true,
  })
  const [leadSourceApiForm, setLeadSourceApiForm] = useState({ label: 'Website Lead Capture', provider: 'website_api', defaultSource: 'website', defaultAssignedTo: '' })
  const [leadSourceApiCredential, setLeadSourceApiCredential] = useState(null)
  const [leadSourceEventStatus, setLeadSourceEventStatus] = useState('failed')

  const selectedLeadSourceConnectionId = leadSourceMappingForm.connectionId
  const selectedLeadSourcePageId = leadSourceMappingForm.externalPageId
  const { data: metaPagesResp, isFetching: loadingMetaPages } = useGetMetaPagesQuery(selectedLeadSourceConnectionId, { skip: !selectedLeadSourceConnectionId })
  const { data: metaFormsResp, isFetching: loadingMetaForms } = useGetMetaLeadFormsQuery(
    { connectionId: selectedLeadSourceConnectionId, pageId: selectedLeadSourcePageId },
    { skip: !selectedLeadSourceConnectionId || !selectedLeadSourcePageId }
  )
  const { data: leadSourceEventsResp } = useGetLeadSourceEventsQuery({ status: leadSourceEventStatus, limit: 10 })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const metaStatus = params.get('meta')
    if (!metaStatus) return
    setActiveTab('lead_sources')
    if (metaStatus === 'connected') toast('Meta account connected successfully', 'success')
    else toast(params.get('message') || 'Meta account connection failed', 'error')
    window.history.replaceState({}, '', window.location.pathname)
  }, [toast])

  // Sync activeBranchId to invite form when it changes
  useEffect(() => {
    if (activeBranchId && !inviteForm.branchId) {
      setInviteForm(prev => ({ ...prev, branchId: activeBranchId }))
    }
  }, [activeBranchId, inviteForm.branchId])

  // Sync form state
  useEffect(() => {
    if (profileData?.data) {
      setCompanyForm({
        companyName: profileData.data.companyName || '',
        email: profileData.data.email || '',
        phone: profileData.data.phone || '',
        logo: profileData.data.logo || '',
        address: profileData.data.address || '',
        timezone: profileData.data.timezone || 'Asia/Kolkata',
        website: profileData.data.website || ''
      })
    }
  }, [profileData])

  useEffect(() => {
    if (profileData?.data?.pipelineStages) {
      setPipelineDraft([...profileData.data.pipelineStages].sort((a, b) => (a.order || 0) - (b.order || 0)))
    }
  }, [profileData])

  useEffect(() => {
    const policy = assignmentPolicyResp?.data
    if (policy) {
      setAssignmentForm({
        strategy: policy.strategy || 'manual',
        isActive: policy.isActive !== false,
        agentIds: (policy.agentIds || []).map(String),
      })
    } else {
      setAssignmentForm({ strategy: 'manual', isActive: true, agentIds: [] })
    }
  }, [assignmentPolicyResp])

  const handleStartMetaOAuth = async () => {
    try {
      const response = await getMetaOAuthUrl({ branchId: activeBranchId || undefined }).unwrap()
      if (!response.data?.authorizationUrl) throw new Error('Meta authorization URL was not returned')
      window.location.assign(response.data.authorizationUrl)
    } catch (err) {
      toast(err.data?.message || err.message || 'Could not start Meta connection', 'error')
    }
  }

  const handleSaveLeadSourceConnection = async () => {
    if (!leadSourceConnectionForm.externalAccountId) return toast('Meta account/page ID is required', 'error')
    if (!leadSourceConnectionForm.accessToken) return toast('Access token is required', 'error')
    try {
      await saveLeadSourceConnection({
        provider: 'meta_lead_ads',
        branchId: activeBranchId || null,
        ...leadSourceConnectionForm,
      }).unwrap()
      toast('Meta Lead Ads connection saved', 'success')
      setLeadSourceConnectionForm((prev) => ({ ...prev, accessToken: '' }))
    } catch (err) {
      toast(err.data?.message || 'Failed to save lead source connection', 'error')
    }
  }

  const handleCreateLeadSourceApi = async () => {
    try {
      const response = await createLeadSourceApiConnection({ branchId: activeBranchId || null, ...leadSourceApiForm, defaultAssignedTo: leadSourceApiForm.defaultAssignedTo || null }).unwrap()
      setLeadSourceApiCredential(response.data)
      toast('Inbound lead API created. Save the key now.', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to create inbound lead API', 'error')
    }
  }

  const handleRotateLeadSourceApi = async (connectionId) => {
    if (!confirm('Rotate this API key? The previous key will stop working immediately.')) return
    try {
      const response = await rotateLeadSourceApiKey(connectionId).unwrap()
      setLeadSourceApiCredential({ ...response.data, connectionId })
      toast('API key rotated. Save the new key now.', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to rotate API key', 'error')
    }
  }

  const handleSaveLeadSourceMapping = async () => {
    if (!leadSourceMappingForm.connectionId) return toast('Select a connection first', 'error')
    if (!leadSourceMappingForm.externalPageId || !leadSourceMappingForm.externalFormId) return toast('Page ID and Form ID are required', 'error')
    if (leadSourceMappingForm.sendWelcomeMessage && !leadSourceMappingForm.welcomeTemplateName) return toast('Approved WhatsApp template name is required', 'error')
    try {
      await saveLeadSourceMapping({
        branchId: activeBranchId || null,
        ...leadSourceMappingForm,
        defaultAssignedTo: leadSourceMappingForm.defaultAssignedTo || null,
      }).unwrap()
      toast('Meta form mapping saved', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to save lead source mapping', 'error')
    }
  }

  const handleTestLeadSourceConnection = async (connectionId) => {
    try {
      await testLeadSourceConnection(connectionId).unwrap()
      toast('Meta connection is healthy', 'success')
    } catch (err) {
      toast(err.data?.message || 'Meta connection test failed', 'error')
    }
  }

  const handleSelectMetaPage = (pageId) => {
    const page = (metaPagesResp?.data || []).find((item) => item.id === pageId)
    setLeadSourceMappingForm((prev) => ({
      ...prev,
      externalPageId: pageId,
      externalPageName: page?.name || '',
      externalFormId: '',
      externalFormName: '',
    }))
  }

  const handleSelectMetaForm = (formId) => {
    const form = (metaFormsResp?.data || []).find((item) => item.id === formId)
    setLeadSourceMappingForm((prev) => ({
      ...prev,
      externalFormId: formId,
      externalFormName: form?.name || '',
    }))
  }

  const handleSubscribeMetaPage = async () => {
    if (!selectedLeadSourceConnectionId || !selectedLeadSourcePageId) return toast('Select a connection and page first', 'error')
    try {
      await subscribeMetaPage({ connectionId: selectedLeadSourceConnectionId, pageId: selectedLeadSourcePageId }).unwrap()
      toast('Meta page subscribed to leadgen webhooks', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to subscribe Meta page', 'error')
    }
  }

  const handleReplayLeadSourceEvent = async (eventId) => {
    try {
      await replayLeadSourceEvent(eventId).unwrap()
      toast('Inbound lead event replayed', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to replay inbound lead event', 'error')
    }
  }

  const handleSaveAssignmentPolicy = async () => {
    try {
      await saveAssignmentPolicy({
        branchId: activeBranchId || null,
        name: activeBranchId ? `${getBranchName(activeBranchId)} assignment policy` : 'Default assignment policy',
        strategy: assignmentForm.strategy,
        isActive: assignmentForm.isActive,
        agentIds: assignmentForm.strategy === 'manual' ? [] : assignmentForm.agentIds,
      }).unwrap()
      toast('Assignment policy saved', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to save assignment policy', 'error')
    }
  }

  const toggleAssignmentAgent = (userId) => {
    setAssignmentForm((prev) => ({
      ...prev,
      agentIds: prev.agentIds.includes(userId)
        ? prev.agentIds.filter((id) => id !== userId)
        : [...prev.agentIds, userId],
    }))
  }

  const handleSavePipeline = async () => {
    const normalized = pipelineDraft.map((stage, index) => ({
      name: String(stage.name || '').trim(),
      slug: String(stage.slug || stage.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      color: stage.color || '#6366f1',
      order: index,
    }))
    if (normalized.some((stage) => !stage.name || !stage.slug)) return toast('Every pipeline stage needs a name', 'error')
    if (new Set(normalized.map((stage) => stage.slug)).size !== normalized.length) return toast('Pipeline stage names must be unique', 'error')
    try {
      await updatePipeline({ stages: normalized }).unwrap()
      toast('Pipeline stages updated', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to update pipeline', 'error')
    }
  }

  const handleSaveCompany = async () => {
    try {
      await updateSettings(companyForm).unwrap()
      toast('Company settings updated', 'success')
      refetchProfile()
    } catch {
      toast('Failed to update settings', 'error')
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const res = await getUploadUrl({ 
        uploadType: 'profile', 
        fileType: file.type,
        fileSize: file.size
      }).unwrap()
      const { uploadUrl, key } = res.data

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      })

      const updatedForm = { ...companyForm, logo: key }
      setCompanyForm(updatedForm)
      
      // Update the settings with the key, not the downloadUrl
      await updateSettings({ ...companyForm, logo: key }).unwrap()
      toast('Company logo updated successfully', 'success')
      refetchProfile()
    } catch (err) {
      toast('Failed to upload image', 'error')
    } finally {
      // Clear the input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDisable2FA = async () => {
    if (!passwordForm.currentPassword) return toast('Please enter your current password below to disable 2FA', 'error')
    
    try {
      await disable2FA({ password: passwordForm.currentPassword }).unwrap()
      toast('Two-Factor Authentication Disabled', 'success')
      refetchProfile()
      setPasswordForm(prev => ({ ...prev, currentPassword: '' }))
    } catch (error) {
      toast(error.data?.message || 'Failed to disable 2FA', 'error')
    }
  }

  const handleUpdatePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        return toast('All password fields are required', 'error')
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        return toast('New passwords do not match', 'error')
    }
    try {
        await updatePassword({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword
        }).unwrap()
        toast('Password updated successfully', 'success')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
        toast(err.data?.message || 'Failed to update password', 'error')
    }
  }

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email) return toast('Name and email required', 'error')
    try {
      await inviteUser(inviteForm).unwrap()
      toast('Invitation sent successfully', 'success')
      setShowInvite(false)
      setInviteForm({ name: '', email: '', phone: '', role: 'agent', roleId: '', branchId: '', password: '' })
    } catch (err) {
      toast(err.data?.message || 'Failed to invite', 'error')
    }
  }

  const handleUpdateUser = async () => {
    try {
        const { id, ...data } = editUserForm
        // Remove password if empty
        if (!data.password) delete data.password
        
        await updateUser({ id, ...data }).unwrap()
        toast('User updated successfully', 'success')
        setShowEditUser(false)
    } catch (err) {
        toast(err.data?.message || 'Failed to update user', 'error')
    }
  }


  const handleAddField = async () => {
    try {
      await createCustomField({ entity: fieldForm.entity, label: fieldForm.name, name: fieldForm.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''), type: fieldForm.type, isRequired: fieldForm.required }).unwrap()
      toast('Custom field added', 'success')
      setShowAddField(false)
      setFieldForm({ name: '', type: 'text', required: false, entity: fieldFilter })
    } catch {
      toast('Failed to add field', 'error')
    }
  }

  const handleDeleteField = async (id) => {
    if (!confirm('Are you sure? This will hide data in existing records.')) return
    try {
      await deleteCustomField(id).unwrap()
      toast('Field removed', 'success')
    } catch { toast('Failed to remove field', 'error') }
  }

  const getBranchName = (id) => branches.find(b => b._id === id)?.name || 'Head Office'
  const getRoleName = (id) => roles.find(r => r._id === id)?.name || 'Agent'

  return (
    <div className="relative">
      {/* Cover Header */}
      <div className="absolute top-0 left-0 right-0 h-48 sm:h-64 rounded-xl overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 opacity-90" />
        <img 
          src="/brain/e22d2c29-07fb-4348-8234-c132012d3c8e/settings_cover_banner_1771673225857.png" 
          alt="Cover" 
          className="w-full h-full object-cover mix-blend-overlay"
        />
        <div className="absolute bottom-4 right-4 group">
          <Button variant="soft-primary" size="sm" className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md">
            <Camera size={14} className="mr-1.5" /> Edit Cover
          </Button>
        </div>
      </div>

      <div className="relative pt-32 sm:pt-48 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar - Profile Summary & Tabs */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="!p-0 overflow-hidden text-center">
              <div className="pt-8 pb-6 px-4">
                <div className="relative inline-block mb-3">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  {companyForm.logo ? (
                    <img src={companyForm.logo} alt="Company Logo" className="w-24 h-24 rounded-full border-4 border-[var(--vz-card-bg)] shadow-lg mx-auto object-cover" />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-[var(--vz-card-bg)] bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary shadow-lg mx-auto">
                      {companyForm.companyName?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                  )}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--vz-card-bg)] border border-[var(--vz-border)] flex items-center justify-center text-primary shadow hover:bg-primary/5 transition-colors disabled:opacity-50">
                    {isUploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  </button>
                </div>
                <h4 className="text-base font-bold text-[var(--vz-heading)]">{companyForm.companyName || 'Company Name'}</h4>
                <p className="text-xs text-[var(--vz-text-muted)] mt-1">{profile.planSlug?.toUpperCase() || 'STARTER'} PLAN</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Badge color="success">Trial Active</Badge>
                  <span className="text-xs text-[var(--vz-text-muted)]">24 Days Left</span>
                </div>
              </div>

              <div className="border-t border-[var(--vz-border)] p-2">
                <TabItem icon={Building2} label="Company Details" active={activeTab === 'company'} onClick={() => setActiveTab('company')} />
                {/* <TabItem icon={Users} label="Team Management" active={activeTab === 'users'} onClick={() => setActiveTab('users')} count={users.length} /> */}
                <TabItem icon={GitBranch} label="Pipeline Stages" active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} />
                <TabItem icon={Megaphone} label="Lead Sources" active={activeTab === 'lead_sources'} onClick={() => setActiveTab('lead_sources')} count={leadSourceMappingsResp?.data?.length} />
                <TabItem icon={Shuffle} label="Lead Assignment" active={activeTab === 'assignment'} onClick={() => setActiveTab('assignment')} />
                <TabItem icon={Database} label="Custom Fields" active={activeTab === 'fields'} onClick={() => setActiveTab('fields')} count={customFieldsResp?.data?.length} />
                <TabItem icon={Lock} label="Security" active={activeTab === 'security'} onClick={() => setActiveTab('security')} />
                {currentUser?.role === ROLES.SUPER_ADMIN && (
                  <TabItem icon={MessageCircle} label="WhatsApp Setup" active={activeTab === 'whatsapp'} onClick={() => setActiveTab('whatsapp')} />
                )}
                <TabItem icon={Gift} label="Referral Rewards" active={activeTab === 'referral'} onClick={() => setActiveTab('referral')} />
              </div>
            </Card>

            {/* Storage Usage Widget */}
            <Card className="!p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--vz-heading)] uppercase tracking-wide">Storage Usage</span>
                <span className="text-xs text-primary font-bold">78%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--vz-input-bg)] overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '78%' }} />
              </div>
              <p className="text-[10px] text-[var(--vz-text-muted)] mt-2 italic">* Leads & Files capacity</p>
            </Card>
          </div>

          {/* Right Main Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* 1. Company Information */}
            {activeTab === 'company' && (
              <Card>
                <Card.Header className="flex items-center justify-between">
                  <div>
                    <Card.Title>Company Information</Card.Title>
                    <p className="text-xs text-[var(--vz-text-muted)]">View and update your registered company details</p>
                  </div>
                  <Button onClick={handleSaveCompany} disabled={saving} size="sm">
                    {saving ? 'Updating...' : 'Save Changes'}
                  </Button>
                </Card.Header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Company Name" placeholder="e.g. Acme CRM" value={companyForm.companyName} onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })} />
                  <Input label="Support Email" type="email" placeholder="help@acme.com" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} />
                  <Input label="Phone Number" placeholder="+91 90000 00000" value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} />
                  <Input label="Website" placeholder="https://acme.com" value={companyForm.website} onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })} />
                  <div className="md:col-span-2">
                    <Input label="Business Address" placeholder="Suite 101, Business Park..." value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[var(--vz-heading)]">System Timezone</label>
                    <Select
                      value={companyForm.timezone}
                      onChange={(val) => setCompanyForm({ ...companyForm, timezone: val })}
                      options={[
                        { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
                        { value: 'America/New_York', label: 'America/New_York (EST)' },
                        { value: 'Europe/London', label: 'Europe/London (GMT)' },
                        { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
                        { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT)' }
                      ]}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 3. Pipeline Stages */}
            {activeTab === 'pipeline' && (
              <Card>
                <Card.Header className="flex items-center justify-between gap-3">
                  <div>
                    <Card.Title>Sales Pipeline</Card.Title>
                    <p className="text-xs text-[var(--vz-text-muted)]">Define the stages of your lead qualification process</p>
                  </div>
                  <Button size="sm" onClick={handleSavePipeline} disabled={savingPipeline}>{savingPipeline ? 'Saving...' : 'Save Pipeline'}</Button>
                </Card.Header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {pipelineDraft.map((stage, i) => (
                      <div key={stage?._id || `${stage.slug}-${i}`} className="flex items-center gap-2 p-3 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-input-bg)]">
                        <input type="color" value={stage.color || '#6366f1'} onChange={(e) => setPipelineDraft((current) => current.map((item, index) => index === i ? { ...item, color: e.target.value } : item))} className="w-8 h-8 rounded border-0 bg-transparent" title="Stage color" />
                        <div className="flex-1">
                          <input value={stage.name || ''} onChange={(e) => setPipelineDraft((current) => current.map((item, index) => index === i ? { ...item, name: e.target.value } : item))}
                            className="w-full px-2 py-1 text-sm font-semibold rounded border border-[var(--vz-input-border)] bg-[var(--vz-card-bg)] text-[var(--vz-heading)] outline-none focus:border-primary" />
                          <p className="text-[10px] text-[var(--vz-text-muted)] mt-1">Stage #{i + 1} · {stage.slug || 'slug generated on save'}</p>
                        </div>
                        <button type="button" disabled={pipelineDraft.length <= 2} onClick={() => setPipelineDraft((current) => current.filter((_, index) => index !== i))} className="p-1.5 text-danger hover:bg-danger/10 rounded disabled:opacity-30" title="Remove stage"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <Button variant="soft-primary" className="w-full border-dashed" size="sm" onClick={() => setPipelineDraft((current) => [...current, { name: 'New Stage', slug: `new_stage_${current.length + 1}`, color: '#6366f1', order: current.length }])}>
                      <Plus size={14} className="mr-1" /> Add New Stage
                    </Button>
                  </div>
                  <div className="bg-primary/5 rounded-xl p-6 border border-primary/10">
                    <h6 className="text-sm font-bold text-primary flex items-center gap-2 mb-3">
                      <Briefcase size={16} /> Pipeline Tip
                    </h6>
                    <p className="text-xs text-[var(--vz-text)] leading-relaxed">
                      Commonly, sales pipelines consist of 4–7 stages. Keep stage names short and activity-based (e.g., "Discovery" instead of "Customer Interview").
                    </p>
                    <div className="mt-4 pt-4 border-t border-primary/10">
                      <div className="flex items-center gap-2 text-xs text-primary font-bold">
                        <CheckCircle2 size={12} /> Optimized for Hubspot compatibility
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* 4. Lead Sources */}
            {activeTab === 'lead_sources' && (
              <div className="space-y-5">
                <Card>
                  <Card.Header>
                    <Card.Title>Meta Lead Ads Webhook</Card.Title>
                    <p className="text-xs text-[var(--vz-text-muted)]">Use this webhook URL in your Meta app for Facebook and Instagram Lead Ads.</p>
                  </Card.Header>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 p-3 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-input-bg)] text-xs text-[var(--vz-heading)] break-all">
                      {metaWebhookConfigResp?.data?.webhookUrl || 'Webhook URL unavailable'}
                    </div>
                    <div className="space-y-1 text-xs">
                      <Badge color={metaWebhookConfigResp?.data?.verifyTokenConfigured ? 'success' : 'danger'}>
                        Verify token {metaWebhookConfigResp?.data?.verifyTokenConfigured ? 'set' : 'missing'}
                      </Badge>
                      <Badge color={metaWebhookConfigResp?.data?.appIdConfigured ? 'success' : 'danger'}>
                        App ID {metaWebhookConfigResp?.data?.appIdConfigured ? 'set' : 'missing'}
                      </Badge>
                      <Badge color={metaWebhookConfigResp?.data?.appSecretConfigured ? 'success' : 'danger'}>
                        App secret {metaWebhookConfigResp?.data?.appSecretConfigured ? 'set' : 'missing'}
                      </Badge>
                    </div>
                  </div>
                </Card>

                <Card>
                  <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <Card.Title>Website / Custom Lead API</Card.Title>
                      <p className="text-xs text-[var(--vz-text-muted)]">Create a tenant-scoped API endpoint for websites, Google Ads middleware, marketplaces, or custom integrations.</p>
                    </div>
                    <Button size="sm" onClick={handleCreateLeadSourceApi} disabled={creatingLeadSourceApi}>{creatingLeadSourceApi ? 'Creating...' : 'Create API Connection'}</Button>
                  </Card.Header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Connection Name" value={leadSourceApiForm.label} onChange={(e) => setLeadSourceApiForm({ ...leadSourceApiForm, label: e.target.value })} />
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceApiForm.provider}
                        onChange={(val) => setLeadSourceApiForm({ ...leadSourceApiForm, provider: val, defaultSource: val === 'website_api' ? 'website' : val === 'google_ads' ? 'google_ads' : 'api' })}
                        options={[
                          { value: 'website_api', label: 'Website API' },
                          { value: 'google_ads', label: 'Google Ads Middleware' },
                          { value: 'custom_api', label: 'Custom API' }
                        ]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceApiForm.defaultAssignedTo}
                        onChange={(val) => setLeadSourceApiForm({ ...leadSourceApiForm, defaultAssignedTo: val })}
                        options={[
                          { value: '', label: 'Use assignment policy' },
                          ...users.filter((user) => user.isActive !== false).map((user) => ({ value: user._id, label: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email }))
                        ]}
                      />
                    </div>
                  </div>

                  {leadSourceApiCredential?.apiKey && (
                    <div className="mt-5 p-4 rounded-xl border border-warning/30 bg-warning/10 space-y-3">
                      <div className="flex items-center gap-2 text-warning font-bold text-sm"><AlertTriangle size={16} /> Save this API key now. It will not be displayed again.</div>
                      {leadSourceApiCredential.endpoint && <div><p className="text-[10px] uppercase text-[var(--vz-text-muted)]">Endpoint</p><code className="text-xs break-all text-[var(--vz-heading)]">{leadSourceApiCredential.endpoint}</code></div>}
                      <div><p className="text-[10px] uppercase text-[var(--vz-text-muted)]">Bearer API Key</p><code className="text-xs break-all text-[var(--vz-heading)]">{leadSourceApiCredential.apiKey}</code></div>
                      <Button size="sm" variant="soft-primary" onClick={() => navigator.clipboard?.writeText(leadSourceApiCredential.apiKey)}><Copy size={13} className="mr-1" /> Copy Key</Button>
                    </div>
                  )}

                  {(leadSourceConnectionsResp?.data || []).filter((connection) => ['website_api', 'custom_api', 'google_ads'].includes(connection.provider)).length > 0 && (
                    <div className="mt-5 space-y-2">
                      {(leadSourceConnectionsResp?.data || []).filter((connection) => ['website_api', 'custom_api', 'google_ads'].includes(connection.provider)).map((connection) => (
                        <div key={connection._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-[var(--vz-border)]">
                          <div><p className="text-sm font-semibold text-[var(--vz-heading)]">{connection.label}</p><p className="text-xs text-[var(--vz-text-muted)]">{connection.provider} · Key prefix {connection.apiKeyPrefix || '—'} · {connection.isActive ? 'Active' : 'Inactive'}</p></div>
                          <Button size="sm" variant="soft-primary" onClick={() => handleRotateLeadSourceApi(connection._id)}><RefreshCw size={13} className="mr-1" /> Rotate Key</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <Card.Title>Connect Meta Lead Ads</Card.Title>
                      <p className="text-xs text-[var(--vz-text-muted)]">Store the tenant's Meta page/system-user token. Secrets are masked after saving.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="soft-primary" onClick={handleStartMetaOAuth} disabled={startingMetaOAuth || !metaWebhookConfigResp?.data?.appIdConfigured || !metaWebhookConfigResp?.data?.appSecretConfigured}>
                        <ExternalLink size={14} className="mr-1" /> {startingMetaOAuth ? 'Connecting...' : 'Connect with Meta'}
                      </Button>
                      <Button size="sm" onClick={handleSaveLeadSourceConnection} disabled={savingLeadSourceConnection}>
                        {savingLeadSourceConnection ? 'Saving...' : 'Save Manually'}
                      </Button>
                    </div>
                  </Card.Header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Connection Name" value={leadSourceConnectionForm.label} onChange={(e) => setLeadSourceConnectionForm({ ...leadSourceConnectionForm, label: e.target.value })} />
                    <Input label="Meta Page / Account ID" value={leadSourceConnectionForm.externalAccountId} onChange={(e) => setLeadSourceConnectionForm({ ...leadSourceConnectionForm, externalAccountId: e.target.value })} />
                    <Input label="Account Name" value={leadSourceConnectionForm.externalAccountName} onChange={(e) => setLeadSourceConnectionForm({ ...leadSourceConnectionForm, externalAccountName: e.target.value })} />
                    <Input label="Access Token" type="password" value={leadSourceConnectionForm.accessToken} onChange={(e) => setLeadSourceConnectionForm({ ...leadSourceConnectionForm, accessToken: e.target.value })} />
                  </div>

                  {(leadSourceConnectionsResp?.data || []).some((connection) => connection.provider === 'meta_lead_ads') && (
                    <div className="mt-5 space-y-2">
                      <h6 className="text-sm font-bold text-[var(--vz-heading)]">Saved Meta Connections</h6>
                      {(leadSourceConnectionsResp?.data || []).filter((connection) => connection.provider === 'meta_lead_ads').map((connection) => (
                        <div key={connection._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-[var(--vz-border)]">
                          <div>
                            <p className="text-sm font-semibold text-[var(--vz-heading)]">{connection.label || connection.externalAccountName || connection.externalAccountId}</p>
                            <p className="text-xs text-[var(--vz-text-muted)]">
                              {connection.externalAccountId} · Health: {connection.health?.status || 'unknown'}
                              {connection.health?.message ? ` · ${connection.health.message}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge color={connection.health?.status === 'healthy' ? 'success' : connection.health?.status === 'expiring' ? 'warning' : connection.health?.status === 'failed' ? 'danger' : 'info'}>{connection.health?.status || 'unknown'}</Badge>
                            <Badge color={connection.isActive ? 'success' : 'danger'}>{connection.isActive ? 'Active' : 'Inactive'}</Badge>
                            <Button size="sm" variant="soft-primary" onClick={() => handleTestLeadSourceConnection(connection._id)} disabled={testingLeadSourceConnection}>
                              <TestTube2 size={14} className="mr-1" /> Test
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <Card.Title>Map Page/Form to CRM</Card.Title>
                      <p className="text-xs text-[var(--vz-text-muted)]">Only mapped Meta forms will create leads in this tenant.</p>
                    </div>
                    <Button size="sm" onClick={handleSaveLeadSourceMapping} disabled={savingLeadSourceMapping}>
                      {savingLeadSourceMapping ? 'Saving...' : 'Save Mapping'}
                    </Button>
                  </Card.Header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceMappingForm.connectionId}
                        onChange={(val) => setLeadSourceMappingForm({ ...leadSourceMappingForm, connectionId: val })}
                        options={[
                          { value: '', label: 'Select connection' },
                          ...(leadSourceConnectionsResp?.data || []).map((connection) => ({ value: connection._id, label: connection.label || connection.externalAccountId }))
                        ]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceMappingForm.source}
                        onChange={(val) => setLeadSourceMappingForm({ ...leadSourceMappingForm, source: val })}
                        options={[
                          { value: 'facebook', label: 'Facebook' },
                          { value: 'instagram', label: 'Instagram' }
                        ]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceMappingForm.externalPageId}
                        onChange={(val) => handleSelectMetaPage(val)}
                        disabled={!selectedLeadSourceConnectionId || loadingMetaPages}
                        options={[
                          { value: '', label: loadingMetaPages ? 'Loading pages...' : 'Select discovered page or enter manually' },
                          ...(metaPagesResp?.data || []).map((page) => ({ value: page.id, label: page.name || page.id }))
                        ]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceMappingForm.externalFormId}
                        onChange={(val) => handleSelectMetaForm(val)}
                        disabled={!selectedLeadSourcePageId || loadingMetaForms}
                        options={[
                          { value: '', label: loadingMetaForms ? 'Loading forms...' : 'Select discovered form or enter manually' },
                          ...(metaFormsResp?.data || []).map((form) => ({ value: form.id, label: form.name || form.id }))
                        ]}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="soft-primary" size="sm" onClick={handleSubscribeMetaPage} disabled={!selectedLeadSourceConnectionId || !selectedLeadSourcePageId || subscribingMetaPage}>
                        <Plug size={14} className="mr-1" /> Subscribe Page
                      </Button>
                    </div>
                    <Input label="Page ID" value={leadSourceMappingForm.externalPageId} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, externalPageId: e.target.value })} />
                    <Input label="Page Name" value={leadSourceMappingForm.externalPageName} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, externalPageName: e.target.value })} />
                    <Input label="Lead Form ID" value={leadSourceMappingForm.externalFormId} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, externalFormId: e.target.value })} />
                    <Input label="Lead Form Name" value={leadSourceMappingForm.externalFormName} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, externalFormName: e.target.value })} />
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceMappingForm.welcomeTemplateName}
                        disabled={!leadSourceMappingForm.sendWelcomeMessage}
                        onChange={(val) => setLeadSourceMappingForm({ ...leadSourceMappingForm, welcomeTemplateName: val })}
                        options={[
                          { value: '', label: 'Select approved template' },
                          ...(whatsappTemplatesResp?.data || []).filter((template) => template.status === 'approved' && template.isActive !== false).map((template) => ({ value: template.name, label: `${template.name} (${template.language || 'en'})` }))
                        ]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[var(--vz-heading)]">Meta Consent Field</label>
                      <Input placeholder="whatsapp_opt_in" value={leadSourceMappingForm.fieldMapping?.whatsappConsent || ''} disabled={!leadSourceMappingForm.sendWelcomeMessage || !leadSourceMappingForm.requireWhatsappConsent} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, fieldMapping: { ...leadSourceMappingForm.fieldMapping, whatsappConsent: e.target.value } })} />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--vz-heading)] pt-7">
                      <input type="checkbox" checked={leadSourceMappingForm.sendWelcomeMessage} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, sendWelcomeMessage: e.target.checked })} />
                      Send approved WhatsApp welcome template
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--vz-heading)] pt-7">
                      <input type="checkbox" checked={leadSourceMappingForm.requireWhatsappConsent} disabled={!leadSourceMappingForm.sendWelcomeMessage} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, requireWhatsappConsent: e.target.checked })} />
                      Require explicit WhatsApp consent
                    </label>
                    <div className="space-y-1.5">
                      <Select
                        value={leadSourceMappingForm.defaultAssignedTo}
                        onChange={(val) => setLeadSourceMappingForm({ ...leadSourceMappingForm, defaultAssignedTo: val })}
                        options={[
                          { value: '', label: 'Use assignment policy' },
                          ...users.filter((u) => u.isActive !== false).map((u) => ({ value: u._id, label: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email }))
                        ]}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--vz-heading)] pt-7">
                      <input type="checkbox" checked={leadSourceMappingForm.isActive} onChange={(e) => setLeadSourceMappingForm({ ...leadSourceMappingForm, isActive: e.target.checked })} />
                      Active mapping
                    </label>
                  </div>
                </Card>

                <Card>
                  <Card.Header><Card.Title>Configured Meta Forms</Card.Title></Card.Header>
                  {(!leadSourceMappingsResp?.data || leadSourceMappingsResp.data.length === 0) ? (
                    <EmptyState icon={Megaphone} title="No Meta forms mapped" description="Map a Facebook or Instagram Lead Ads form to start importing leads." />
                  ) : (
                    <div className="space-y-2">
                      {leadSourceMappingsResp.data.map((mapping) => (
                        <div key={mapping._id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--vz-border)]">
                          <div>
                            <p className="text-sm font-semibold text-[var(--vz-heading)]">{mapping.externalFormName || mapping.externalFormId}</p>
                            <p className="text-xs text-[var(--vz-text-muted)]">{mapping.source} · Page {mapping.externalPageName || mapping.externalPageId}</p>
                          </div>
                          <Badge color={mapping.isActive ? 'success' : 'danger'}>{mapping.isActive ? 'Active' : 'Inactive'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <Card.Title>Inbound Meta Lead Events</Card.Title>
                      <p className="text-xs text-[var(--vz-text-muted)]">Review tenant-owned webhook events and replay failed imports after fixing setup.</p>
                    </div>
                    <Select
                      value={leadSourceEventStatus}
                      onChange={(val) => setLeadSourceEventStatus(val)}
                      className="w-40"
                      options={[
                        { value: 'failed', label: 'Failed' },
                        { value: 'unmapped', label: 'Unmapped' },
                        { value: 'processing', label: 'Processing' },
                        { value: 'processed', label: 'Processed' },
                        { value: 'duplicate', label: 'Duplicate' },
                        { value: 'all', label: 'All' }
                      ]}
                    />
                  </Card.Header>
                  {(!leadSourceEventsResp?.data || leadSourceEventsResp.data.length === 0) ? (
                    <EmptyState icon={RefreshCw} title="No inbound events" description="Meta webhook events for this tenant will appear here after they are received." />
                  ) : (
                    <div className="space-y-2">
                      {leadSourceEventsResp.data.map((event) => (
                        <div key={event._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-[var(--vz-border)]">
                          <div>
                            <p className="text-sm font-semibold text-[var(--vz-heading)]">Lead {event.externalLeadId || 'Unknown'}</p>
                            <p className="text-xs text-[var(--vz-text-muted)]">
                              Page {event.externalPageId || '-'} · Form {event.externalFormId || '-'} · Attempts {event.attempts || 0}
                              {event.error ? ` · ${event.error}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge color={event.status === 'processed' ? 'success' : event.status === 'failed' ? 'danger' : 'warning'}>{event.status}</Badge>
                            {['failed', 'unmapped'].includes(event.status) && (
                              <Button size="sm" variant="soft-primary" onClick={() => handleReplayLeadSourceEvent(event._id)} disabled={replayingLeadSourceEvent}>
                                <RefreshCw size={14} className="mr-1" /> Replay
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* 5. Lead Assignment */}
            {activeTab === 'assignment' && (
              <Card>
                <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <Card.Title>Lead Assignment</Card.Title>
                    <p className="text-xs text-[var(--vz-text-muted)]">Configure automatic lead distribution for newly captured unassigned leads</p>
                  </div>
                  <Button size="sm" onClick={handleSaveAssignmentPolicy} disabled={savingAssignment}>
                    {savingAssignment ? 'Saving...' : 'Save Policy'}
                  </Button>
                </Card.Header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-1 space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[var(--vz-heading)]">Strategy</label>
                      <Select
                        value={assignmentForm.strategy}
                        onChange={(val) => setAssignmentForm({ ...assignmentForm, strategy: val })}
                        options={[
                          { value: 'manual', label: 'Manual / keep current behavior' },
                          { value: 'round_robin', label: 'Round robin' },
                          { value: 'load_based', label: 'Least active leads' }
                        ]}
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-[var(--vz-heading)]">
                      <input
                        type="checkbox"
                        checked={assignmentForm.isActive}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, isActive: e.target.checked })}
                      />
                      Enable this policy
                    </label>

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-[var(--vz-text)] leading-relaxed">
                      Explicit assignees are always respected. This policy only applies when a lead enters without an assigned user, such as future ad leads or forms without a fixed assignee.
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <h6 className="text-sm font-bold text-[var(--vz-heading)]">Eligible Agents</h6>
                      <span className="text-xs text-[var(--vz-text-muted)]">{assignmentForm.agentIds.length} selected</span>
                    </div>

                    {assignmentForm.strategy === 'manual' ? (
                      <EmptyState icon={UserCheck} title="Manual assignment selected" description="New leads will keep the existing manual assignment behavior." />
                    ) : users.length === 0 ? (
                      <EmptyState icon={Users} title="No users found" description="Invite users before enabling automatic lead distribution." />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {users.filter((u) => u.isActive !== false).map((u) => (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => toggleAssignmentAgent(u._id)}
                            className={`text-left p-3 rounded-lg border transition-all ${assignmentForm.agentIds.includes(u._id)
                              ? 'border-primary bg-primary/10'
                              : 'border-[var(--vz-border)] hover:border-primary/50'}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[var(--vz-heading)]">{u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}</p>
                                <p className="text-[11px] text-[var(--vz-text-muted)]">{getRoleName(u.roleId)} · {getBranchName(u.branchId)}</p>
                              </div>
                              {assignmentForm.agentIds.includes(u._id) && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* 5. Custom Fields */}
            {activeTab === 'fields' && (
              <Card>
                <Card.Header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div>
                    <Card.Title>Polymorphic Custom Fields</Card.Title>
                    <p className="text-xs text-[var(--vz-text-muted)]">Extend any CRM entity with dynamic data fields</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={fieldFilter} 
                      onChange={(val) => setFieldFilter(val)}
                      className="w-40"
                      options={['Lead', 'User', 'Meeting', 'Branch', 'Role'].map(ent => ({ value: ent, label: `${ent} Fields` }))}
                    />
                    <Button size="sm" onClick={() => { setFieldForm({ ...fieldForm, targetEntity: fieldFilter }); setShowAddField(true); }}>
                      <Plus size={14} className="mr-1.5" /> Add Field
                    </Button>
                  </div>
                </Card.Header>
                
                {fieldsLoading ? (
                  <div className="py-20 text-center">
                    <Loader2 size={32} className="text-primary animate-spin inline-block" />
                  </div>
                ) : (!customFieldsResp?.data || customFieldsResp.data.filter(f => f.entity === fieldFilter).length === 0) ? (
                  <EmptyState icon={Database} title={`No ${fieldFilter} Fields`} description={`You haven't added any custom fields for ${fieldFilter}s yet.`} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customFieldsResp.data.filter(f => f.entity === fieldFilter).map((f) => (
                      <div key={f._id} className="p-4 rounded-xl border border-[var(--vz-border)] hover:bg-[var(--vz-body-bg)]/50 transition-all cursor-default group">
                        <div className="flex items-start justify-between mb-2">
                           <div className="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center">
                              {f.type === 'text' && <LayoutGrid size={16} />}
                              {f.type === 'number' && <p className="font-bold text-xs">#</p>}
                              {f.type === 'date' && <Clock size={16} />}
                              {!['text','number','date'].includes(f.type) && <Smartphone size={16} />}
                           </div>
                           <div className="flex gap-1">
                             {f.required && <Badge color="danger">Req</Badge>}
                             <Badge color="soft-primary" className="capitalize">{f.type}</Badge>
                           </div>
                        </div>
                        <p className="text-sm font-bold text-[var(--vz-heading)]">{f.name}</p>
                        <p className="text-[10px] text-[var(--vz-text-muted)] uppercase tracking-tight">{f.targetEntity} Module</p>
                        <div className="mt-3 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => handleDeleteField(f._id)} className="text-xs text-danger font-bold flex items-center gap-1 hover:underline">
                             <Trash2 size={10} /> Delete
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}


            {/* 5. Security */}
            {activeTab === 'security' && (
              <Card>
                <Card.Header>
                  <Card.Title>Security Settings</Card.Title>
                  <p className="text-xs text-[var(--vz-text-muted)]">Manage your authentication and account protection</p>
                </Card.Header>
                <div className="space-y-6">
                  <div>
                    <h6 className="text-sm font-bold text-[var(--vz-heading)] mb-3">Two-Factor Authentication</h6>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--vz-body-bg)] border border-[var(--vz-border)]">
                      <div className="flex items-start gap-3">
                        <Smartphone className="text-primary mt-0.5" />
                        <div>
                           <p className="text-sm font-semibold text-[var(--vz-heading)]">Authenticator App</p>
                           <p className="text-xs text-[var(--vz-text-muted)]">
                             {profile?.twoFactorEnabled 
                               ? '2FA is currently enabled for your account.' 
                               : 'Use Google Authenticator or Microsoft Authenticator'}
                           </p>
                        </div>
                      </div>
                      {profile?.twoFactorEnabled ? (
                        <Button variant="soft-danger" size="sm" onClick={handleDisable2FA} disabled={disabling2FA}>
                          {disabling2FA ? 'Disabling...' : 'Disable'}
                        </Button>
                      ) : (
                        <Button variant="soft-primary" size="sm" onClick={() => setShow2FAModal(true)}>
                          Enable
                        </Button>
                      )}
                    </div>
                  </div>
                   <div>
                    <h6 className="text-sm font-bold text-[var(--vz-heading)] mb-3">Change Password</h6>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <Input label="Current Password" type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
                       <Input label="New Password" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
                       <Input label="Confirm Password" type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
                       <div className="md:col-span-3">
                          <Button size="sm" onClick={handleUpdatePassword} disabled={updatingPassword}>
                              {updatingPassword ? 'Updating...' : 'Update Password'}
                          </Button>
                       </div>
                    </div>
                  </div>

                  {/* Trusted Devices Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h6 className="text-sm font-bold text-[var(--vz-heading)]">Trusted Devices</h6>
                      <Button variant="soft-danger" size="sm" onClick={() => revokeAllTrustedDevices().unwrap().then(() => toast('All trusted devices revoked', 'success'))} disabled={revokingAllDevices}>
                        Revoke All
                      </Button>
                    </div>
                    {trustedDevicesLoading ? (
                      <div className="py-8 text-center text-[var(--vz-text-muted)] text-sm">Loading trusted devices...</div>
                    ) : (!trustedDevicesResp?.data || trustedDevicesResp.data.length === 0) ? (
                      <EmptyState icon={Lock} title="No Trusted Devices" description="You don't have any trusted devices yet." />
                    ) : (
                      <div className="space-y-2">
                        {trustedDevicesResp.data.map((device) => (
                          <div key={device._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[var(--vz-body-bg)] border border-[var(--vz-border)]">
                            <div>
                              <p className="text-sm font-semibold text-[var(--vz-heading)]">{device.deviceName}</p>
                              <p className="text-xs text-[var(--vz-text-muted)]">
                                IP: {device.ipAddress} · Last used: {new Date(device.lastUsedAt).toLocaleDateString()}
                              </p>
                              <p className="text-[10px] text-[var(--vz-text-muted)] mt-1 opacity-70">
                                Expires: {new Date(device.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-danger hover:bg-danger/10" 
                              onClick={() => revokeTrustedDevice(device._id).unwrap().then(() => toast('Device revoked', 'success'))}
                            >
                              Revoke
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </Card>
            )}

            {/* 6. Referral */}
            {activeTab === 'referral' && (
              <Card>
                 <Card.Header>
                  <Card.Title>Referral Program</Card.Title>
                  <p className="text-xs text-[var(--vz-text-muted)]">Invite friends and earn rewards on every subscription</p>
                </Card.Header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg">
                        <Gift className="mb-3 opacity-80" size={32} />
                        <h4 className="text-xl font-bold mb-1">Refer and Earn</h4>
                        <p className="text-xs opacity-80 leading-relaxed mb-4">Sharing is caring. Give your friends 1 free month and get ₹500 in your account.</p>
                        <div className="flex items-center gap-2 p-2 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
                           <input readOnly value={referralCode} className="bg-transparent border-none outline-none text-white font-bold text-sm flex-1 ml-2" />
                           <button onClick={() => { navigator.clipboard.writeText(referralCode); toast('Link copied!', 'success') }}
                             className="p-2 rounded bg-white/20 hover:bg-white/30 transition-colors"><Copy size={16} /></button>
                        </div>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-[var(--vz-border)] text-center">
                        <p className="text-[10px] text-[var(--vz-text-muted)] uppercase tracking-widest font-bold mb-1">Signups</p>
                        <p className="text-2xl font-black text-[var(--vz-heading)]">{refStats.totalReferrals || 0}</p>
                        <div className="mt-2 text-[10px] text-success font-bold">+2 this week</div>
                      </div>
                      <div className="p-4 rounded-xl border border-[var(--vz-border)] text-center">
                        <p className="text-[10px] text-[var(--vz-text-muted)] uppercase tracking-widest font-bold mb-1">Commission</p>
                        <p className="text-2xl font-black text-secondary">₹{refStats.totalRewards || 0}</p>
                        <div className="mt-2 text-[10px] text-[var(--vz-text-muted)]">Redeem after ₹1,000</div>
                      </div>
                   </div>
                </div>
              </Card>
            )}

            {/* WhatsApp Setup — Super Admin only */}
            {activeTab === 'whatsapp' && <WhatsAppSetupTab toast={toast} />}

          </div>
        </div>
      </div>

      {/* Modals */}
      <TwoFactorSetupModal 
        isOpen={show2FAModal} 
        onClose={(success) => {
          setShow2FAModal(false)
          if (success) refetchProfile()
        }} 
      />
      
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member" size="md">
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
             <Input label="Full Name" placeholder="John Doe" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
             <Input label="Email Address" type="email" placeholder="john@example.com" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
               <label className="block text-sm font-medium text-[var(--vz-heading)]">Role</label>
               <Select
                 value={inviteForm.roleId || ''}
                 onChange={(val) => setInviteForm({ ...inviteForm, roleId: val })}
                 options={[
                   { value: '', label: 'Select Role' },
                   ...roles.map(r => ({ value: r._id, label: r.name }))
                 ]}
               />
             </div>
             <div className="space-y-1.5">
               <label className="block text-sm font-medium text-[var(--vz-heading)]">Primary Branch</label>
               <Select
                 value={inviteForm.branchId || ''}
                 onChange={(val) => setInviteForm({ ...inviteForm, branchId: val })}
                 options={[
                   { value: '', label: 'Select Branch' },
                   ...branches.map(b => ({ value: b._id, label: b.name }))
                 ]}
               />
             </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <Input label="Set Password" type="password" placeholder="••••••••" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} />
          </div>

          {/* User Custom Fields */}
          {customFieldsResp?.data?.filter(f => f.entity === 'User').length > 0 && (
            <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
              <h6 className="text-[10px] font-bold text-[var(--vz-text-muted)] uppercase tracking-wider">Additional User Details</h6>
              <div className="grid grid-cols-2 gap-3">
                {customFieldsResp.data.filter(f => f.entity === 'User').map(field => (
                  <div key={field._id}>
                    <label className="block text-xs font-semibold text-[var(--vz-heading)] mb-1">{field.name}</label>
                    <Input 
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      placeholder={field.name}
                      value={inviteForm.customFields[field.name] || ''}
                      onChange={(e) => setInviteForm({ ...inviteForm, customFields: { ...inviteForm.customFields, [field.name]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] text-[var(--vz-text-muted)] leading-relaxed italic">
            Note: An invitation email will be sent. If you specify a password, the user can log in immediately. Otherwise, a random temporary password will be generated.
          </p>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowInvite(false)}>Cancel</Button>
          <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteForm.name || !inviteForm.email}>
            {inviting ? 'Processing...' : 'Send Invitation'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditUser} onClose={() => setShowEditUser(false)} title="Edit Team Member" size="md">
        {editUserForm && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
               <Input label="Full Name" placeholder="John Doe" value={editUserForm.name} onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })} />
               <Input label="Email Address" type="email" readOnly value={editUserForm.email} className="bg-[var(--vz-body-bg)]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                 <label className="block text-sm font-medium text-[var(--vz-heading)]">Role</label>
                 <Select
                   value={editUserForm.roleId || ''}
                   onChange={(val) => setEditUserForm({ ...editUserForm, roleId: val })}
                   options={[
                     { value: '', label: 'Select Role' },
                     ...roles.map(r => ({ value: r._id, label: r.name }))
                   ]}
                 />
               </div>
               <div className="space-y-1.5">
                 <label className="block text-sm font-medium text-[var(--vz-heading)]">Primary Branch</label>
                 <Select
                   value={editUserForm.branchId || ''}
                   onChange={(val) => setEditUserForm({ ...editUserForm, branchId: val })}
                   options={[
                     { value: '', label: 'Select Branch' },
                     ...branches.map(b => ({ value: b._id, label: b.name }))
                   ]}
                 />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Input label="Phone" placeholder="+91 ..." value={editUserForm.phone} onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value.replace(/[^\d\+\-\(\)\s]/g, '') })} />
                <Input label="Change Password?" type="password" placeholder="Leave blank to keep same" value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} />
             </div>

             {/* Dynamic User Fields */}
             {customFieldsResp?.data?.filter(f => f.entity === 'User').length > 0 && (
              <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
                <h6 className="text-[10px] font-bold text-[var(--vz-text-muted)] uppercase tracking-wider">Additional Information</h6>
                <div className="grid grid-cols-2 gap-3">
                  {customFieldsResp.data.filter(f => f.entity === 'User').map(field => (
                    <div key={field._id}>
                      <label className="block text-xs font-semibold text-[var(--vz-heading)] mb-1">{field.name}</label>
                      <Input 
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        placeholder={field.name}
                        value={editUserForm.customFields[field.name] || ''}
                        onChange={(e) => setEditUserForm({ ...editUserForm, customFields: { ...editUserForm.customFields, [field.name]: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
             )}
            <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="user_active" checked={editUserForm.isActive} onChange={(e) => setEditUserForm({ ...editUserForm, isActive: e.target.checked })} />
                <label htmlFor="user_active" className="text-sm font-medium text-[var(--vz-heading)]">Account Active</label>
            </div>
          </div>
        )}
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowEditUser(false)}>Cancel</Button>
          <Button size="sm" onClick={handleUpdateUser} disabled={updatingUser}>
            {updatingUser ? 'Updating...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal isOpen={showAddField} onClose={() => setShowAddField(false)} title="Add Custom Field" size="sm">
        <div className="space-y-4 py-2">
          <Input label="Display Label" placeholder="e.g. GST Number" value={fieldForm.name} onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Target Module</label>
              <Select
                value={fieldForm.entity}
                onChange={(val) => setFieldForm({ ...fieldForm, entity: val })}
                options={['Lead', 'User', 'Meeting', 'Branch', 'Role'].map(ent => ({ value: ent, label: ent }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Data Type</label>
              <Select
                value={fieldForm.type}
                onChange={(val) => setFieldForm({ ...fieldForm, type: val })}
                options={[
                  { value: 'text', label: 'Text (Single Line)' },
                  { value: 'number', label: 'Numeric / Amount' },
                  { value: 'email', label: 'Email Address' },
                  { value: 'date', label: 'Date Picker' },
                  { value: 'textarea', label: 'Multi-line Text' },
                  { value: 'select', label: 'Dropdown List' }
                ]}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="req_field" checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} className="rounded text-primary focus:ring-primary" />
            <label htmlFor="req_field" className="text-sm text-[var(--vz-heading)] cursor-pointer">Mark as mandatory field</label>
          </div>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowAddField(false)}>Cancel</Button>
          <Button size="sm" onClick={handleAddField} disabled={!fieldForm.name}>Add to Schema</Button>
        </Modal.Footer>
      </Modal>

    </div>
  )
}

// ─── WhatsApp Setup Tab ───────────────────────────────────────────────────────

const MODE_OPTIONS = [
  {
    id: 'meta_shared',
    icon: MessageCircle,
    color: '#25D366',
    title: 'Meta Business API — Shared Number',
    desc: 'All agents send messages from one company WhatsApp Business number. Official, no ban risk.',
    badge: 'Official ✅',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'meta_per_agent',
    icon: Users2,
    color: '#0088cc',
    title: 'Meta Business API — Per Agent',
    desc: 'Each agent gets their own business number assigned by admin. Official, multiple numbers on one WABA.',
    badge: 'Official ✅',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'qr',
    icon: QrCode,
    color: '#FF6B35',
    title: 'QR Code — Agent Personal Numbers',
    desc: 'Each agent scans a QR code to connect their personal WhatsApp number. Feels personal and direct.',
    badge: '⚠️ Unofficial',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
]

function WhatsAppSetupTab({ toast }) {
  const { data: configResp, isLoading } = useGetWhatsAppConfigQuery()
  const [saveConfig, { isLoading: saving }] = useSaveWhatsAppConfigMutation()
  const [testConfig, { isLoading: testing }] = useTestWhatsAppConfigMutation()
  const [deleteConfig, { isLoading: deleting }] = useDeleteWhatsAppConfigMutation()
  const [managePool] = useManagePhonePoolMutation()

  const existing = configResp?.data
  const [selectedMode, setSelectedMode] = useState(existing?.mode || null)
  const [form, setForm] = useState({
    wabaId: '', accessToken: '', appId: '', appSecret: '', verifyToken: '',
    sharedPhoneNumberId: '', sharedPhoneDisplay: '',
  })
  const [showTokens, setShowTokens] = useState({})
  const [testResult, setTestResult] = useState(null)

  // Phone pool management
  const [newPhone, setNewPhone] = useState({ phoneNumberId: '', phoneDisplay: '' })

  // Sync form when existing config loads
  useState(() => {
    if (existing) {
      setSelectedMode(existing.mode)
      setForm({
        wabaId: existing.wabaId || '',
        accessToken: existing.accessToken || '',
        appId: existing.appId || '',
        appSecret: existing.appSecret || '',
        verifyToken: existing.verifyToken || '',
        sharedPhoneNumberId: existing.sharedPhoneNumberId || '',
        sharedPhoneDisplay: existing.sharedPhoneDisplay || '',
      })
      // Show existing test result immediately so user can see if token is expired
      if (existing.testStatus && existing.testStatus !== 'untested') {
        setTestResult({ testStatus: existing.testStatus, testMessage: existing.testMessage })
      }
    }
  }, [existing])

  const handleSave = async () => {
    if (!selectedMode) return toast('Please select a connection mode', 'error')
    try {
      await saveConfig({ ...form, mode: selectedMode, isActive: true }).unwrap()
      toast('WhatsApp configuration saved', 'success')
      setTestResult(null)
    } catch (err) {
      toast(err.data?.message || 'Failed to save configuration', 'error')
    }
  }

  const handleTest = async () => {
    try {
      const res = await testConfig().unwrap()
      setTestResult(res.data || res)
      toast(res.data?.testStatus === 'success' ? 'Connection successful!' : 'Connection test failed', res.data?.testStatus === 'success' ? 'success' : 'error')
    } catch (_err) {
      toast('Connection test failed', 'error')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Remove WhatsApp configuration? Agents will no longer be able to send messages.')) return
    try {
      await deleteConfig().unwrap()
      setSelectedMode(null)
      setForm({ wabaId: '', accessToken: '', appId: '', appSecret: '', verifyToken: '', sharedPhoneNumberId: '', sharedPhoneDisplay: '' })
      toast('WhatsApp configuration removed', 'success')
    } catch {
      toast('Failed to remove configuration', 'error')
    }
  }

  const handleAddPhone = async () => {
    if (!newPhone.phoneNumberId) return toast('Phone Number ID is required', 'error')
    try {
      await managePool({ action: 'add', ...newPhone }).unwrap()
      setNewPhone({ phoneNumberId: '', phoneDisplay: '' })
      toast('Phone number added to pool', 'success')
    } catch (err) {
      toast(err.data?.message || 'Failed to add number', 'error')
    }
  }

  const handleRemovePhone = async (phoneNumberId) => {
    try {
      await managePool({ action: 'remove', phoneNumberId }).unwrap()
      toast('Number removed', 'success')
    } catch { toast('Failed to remove number', 'error') }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] outline-none focus:border-primary transition-colors'

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-base font-bold text-[var(--vz-heading)]">WhatsApp Connection Setup</h5>
          <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">Choose how your team sends WhatsApp messages to customers</p>
        </div>
        {existing && (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${existing.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {existing.isActive ? '● Active' : '○ Inactive'}
            </span>
          </div>
        )}
      </div>

      {/* ⚠️ Token Expired / Connection Failed Banner — shown when Meta API is returning errors */}
      {existing && existing.testStatus === 'failed' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-red-300 bg-red-50">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <WifiOff size={18} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800 mb-1">⚠️ WhatsApp Not Working — Access Token Expired</p>
            <p className="text-xs text-red-700 leading-relaxed mb-3">
              {existing.testMessage?.includes('Expired') || existing.testMessage?.includes('expired')
                ? existing.testMessage
                : 'Your Meta API connection is broken. Most likely your access token has expired.'}
            </p>
            <div className="bg-white border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-red-800 mb-2">How to fix — generate a new token:</p>
              <ol className="text-xs text-red-700 space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-medium">Meta Developer Console</a></li>
                <li>Select your app → WhatsApp → API Setup</li>
                <li>Under <strong>"Access Tokens"</strong>, click <strong>"Generate Access Token"</strong></li>
                <li>OR go to <strong>Business Settings → System Users → [your user] → Generate Token</strong> (set expiry to <strong>Never</strong>)</li>
                <li>Copy the new token and paste it in the <strong>Access Token</strong> field below</li>
                <li>Click <strong>"Update Configuration"</strong>, then <strong>"Test Connection"</strong></li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Mode Selection */}
      <Card>
        <Card.Header>
          <Card.Title>Step 1 — Choose Connection Mode</Card.Title>
          <p className="text-xs text-[var(--vz-text-muted)]">Select the WhatsApp method for your entire organization. You can change this later.</p>
        </Card.Header>
        <div className="grid grid-cols-1 gap-3">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isSelected = selectedMode === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedMode(opt.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-[var(--vz-border)] hover:border-primary/40 hover:bg-[var(--vz-body-bg)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${opt.color}15` }}>
                    <Icon size={20} style={{ color: opt.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-[var(--vz-heading)]">{opt.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${opt.badgeColor}`}>{opt.badge}</span>
                    </div>
                    <p className="text-xs text-[var(--vz-text-muted)] leading-relaxed">{opt.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'border-primary bg-primary' : 'border-[var(--vz-border)]'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Step 2: Credentials (only for Meta modes) */}
      {selectedMode && selectedMode !== 'qr' && (
        <Card>
          <Card.Header>
            <Card.Title>Step 2 — Meta API Credentials</Card.Title>
            <p className="text-xs text-[var(--vz-text-muted)]">
              Get these from{' '}
              <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-primary underline">
                Meta Developer Console <ExternalLink size={10} className="inline" />
              </a>
            </p>
          </Card.Header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">WABA ID <span className="text-danger">*</span></label>
              <input className={inputCls} placeholder="WhatsApp Business Account ID" value={form.wabaId} onChange={e => setForm({...form, wabaId: e.target.value})} />
              <p className="text-[10px] text-[var(--vz-text-muted)]">Found in Meta Business Manager → WhatsApp Accounts</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Meta App ID</label>
              <input className={inputCls} placeholder="App ID from Meta Developer Console" value={form.appId} onChange={e => setForm({...form, appId: e.target.value})} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Access Token <span className="text-danger">*</span></label>
              <div className="relative">
                <input
                  type={showTokens.accessToken ? 'text' : 'password'}
                  className={`${inputCls} pr-10`}
                  placeholder="Permanent access token from System User"
                  value={form.accessToken}
                  onChange={e => setForm({...form, accessToken: e.target.value})}
                />
                <button onClick={() => setShowTokens(p => ({...p, accessToken: !p.accessToken}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]">
                  {showTokens.accessToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-[var(--vz-text-muted)]">Go to Meta Business Settings → System Users → Create a system user → Generate Token with whatsapp_business_messaging permission</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">App Secret</label>
              <div className="relative">
                <input type={showTokens.appSecret ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder="Meta App Secret" value={form.appSecret} onChange={e => setForm({...form, appSecret: e.target.value})} />
                <button onClick={() => setShowTokens(p => ({...p, appSecret: !p.appSecret}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]">
                  {showTokens.appSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Webhook Verify Token</label>
              <input className={inputCls} placeholder="Any random string (e.g. mytoken123)" value={form.verifyToken} onChange={e => setForm({...form, verifyToken: e.target.value})} />
            </div>

            {/* Shared mode: one phone number */}
            {selectedMode === 'meta_shared' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--vz-heading)]">Phone Number ID <span className="text-danger">*</span></label>
                  <input className={inputCls} placeholder="Phone Number ID from Meta" value={form.sharedPhoneNumberId} onChange={e => setForm({...form, sharedPhoneNumberId: e.target.value})} />
                  <p className="text-[10px] text-[var(--vz-text-muted)]">Meta Developer Console → WhatsApp → Phone Numbers → Phone Number ID</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--vz-heading)]">Display Number</label>
                  <input className={inputCls} placeholder="+91 22 1234 5678" value={form.sharedPhoneDisplay} onChange={e => setForm({...form, sharedPhoneDisplay: e.target.value})} />
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Step 2: Phone Pool for meta_per_agent */}
      {selectedMode === 'meta_per_agent' && existing?.mode === 'meta_per_agent' && (
        <Card>
          <Card.Header className="flex items-center justify-between">
            <div>
              <Card.Title>Phone Number Pool</Card.Title>
              <p className="text-xs text-[var(--vz-text-muted)]">Add business phone numbers and assign one to each agent</p>
            </div>
          </Card.Header>

          {/* Add new number */}
          <div className="flex items-end gap-3 mb-4 p-3 bg-[var(--vz-body-bg)] rounded-lg border border-dashed border-[var(--vz-border)]">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[var(--vz-heading)]">Phone Number ID</label>
              <input className={inputCls} placeholder="e.g. 1234567890123456" value={newPhone.phoneNumberId} onChange={e => setNewPhone(p => ({...p, phoneNumberId: e.target.value}))} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-[var(--vz-heading)]">Display Number</label>
              <input className={inputCls} placeholder="+91 98765 43210" value={newPhone.phoneDisplay} onChange={e => setNewPhone(p => ({...p, phoneDisplay: e.target.value}))} />
            </div>
            <Button size="sm" onClick={handleAddPhone}><Hash size={13} className="mr-1" /> Add Number</Button>
          </div>

          {/* Existing pool */}
          {existing?.phonePool?.length > 0 ? (
            <div className="space-y-2">
              {existing.phonePool.map(entry => (
                <div key={entry._id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--vz-heading)]">{entry.phoneDisplay || entry.phoneNumberId}</p>
                      <p className="text-[10px] text-[var(--vz-text-muted)]">ID: {entry.phoneNumberId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.assignedUserId ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                        <UserCheck size={11} /> {entry.assignedUserName || 'Assigned'}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Unassigned</span>
                    )}
                    <button onClick={() => handleRemovePhone(entry.phoneNumberId)} className="p-1.5 text-danger hover:bg-danger/10 rounded transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center text-[var(--vz-text-muted)] py-6">No phone numbers in pool yet. Add numbers above.</p>
          )}
        </Card>
      )}

      {/* Step 2: QR Mode info */}
      {selectedMode === 'qr' && (
        <Card>
          <Card.Header>
            <Card.Title>Step 2 — QR Code Connection</Card.Title>
          </Card.Header>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">Unofficial API — Use Responsibly</p>
                <p className="text-xs text-amber-700 leading-relaxed">QR mode uses WhatsApp Web protocol (Baileys). Meta does not officially support this. Accounts that send too many automated messages may be restricted. For reasonable CRM volumes (up to ~100 msgs/day per agent), it works well in practice — just like TeleCRM and similar tools.</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--vz-body-bg)] border border-[var(--vz-border)]">
            <div className="flex items-center gap-2 mb-3">
              <QrCode size={16} className="text-primary" />
              <span className="text-sm font-semibold text-[var(--vz-heading)]">How it works for agents</span>
            </div>
            <ol className="space-y-2 text-xs text-[var(--vz-text-muted)] list-decimal list-inside">
              <li>Agent opens WhatsApp section in the CRM</li>
              <li>Clicks "Connect My WhatsApp" button</li>
              <li>Scans the QR code with their personal phone → WhatsApp → Linked Devices</li>
              <li>Connection is established — they send messages from their own number</li>
            </ol>
            <p className="text-[11px] text-[var(--vz-text-muted)] mt-3 italic">Note: QR connection feature will be available in the WhatsApp section after saving this mode.</p>
          </div>
        </Card>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${testResult.testStatus === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          {testResult.testStatus === 'success'
            ? <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            : <WifiOff size={18} className="text-red-600 flex-shrink-0 mt-0.5" />}
          <div>
            <p className={`text-sm font-bold ${testResult.testStatus === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
              {testResult.testStatus === 'success' ? 'Connection Successful' : 'Connection Failed'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: testResult.testStatus === 'success' ? '#065f46' : '#991b1b' }}>
              {testResult.testMessage}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedMode && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {existing && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} className="text-danger hover:bg-danger/10">
                {deleting ? <Loader2 size={13} className="animate-spin mr-1" /> : <X size={13} className="mr-1" />}
                Remove Config
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedMode !== 'qr' && existing?.isActive && (
              <Button variant="soft-primary" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 size={13} className="animate-spin mr-1" /> : <TestTube2 size={13} className="mr-1" />}
                Test Connection
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
              {existing ? 'Update Configuration' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Provider Icon Map ───
const PROVIDER_ICONS = {
  exotel: Phone,
  twilio: Phone,
  whatsapp: MessageCircle,
  razorpay: CreditCard,
  smtp: Mail,
  aws_s3: Cloud,
}

const PROVIDER_COLORS = {
  exotel: '#4CAF50',
  twilio: '#F22F46',
  whatsapp: '#25D366',
  razorpay: '#072654',
  smtp: '#EA4335',
  aws_s3: '#FF9900',
}

// Legacy fallback retained while the active integration workflow remains elsewhere.
// eslint-disable-next-line no-unused-vars
function IntegrationsTab({ toast }) {
  const { data: providersResp } = useGetProvidersQuery()
  const { data: integrationsResp, isLoading } = useGetIntegrationsQuery()
  const [saveIntegration, { isLoading: saving }] = useSaveIntegrationMutation()
  const [deleteIntegration] = useDeleteIntegrationMutation()
  const [testIntegration] = useTestIntegrationMutation()

  const [editProvider, setEditProvider] = useState(null)
  const [formValues, setFormValues] = useState({})
  const [showPasswords, setShowPasswords] = useState({})
  const [testingProvider, setTestingProvider] = useState(null)

  const providers = providersResp?.data || {}
  const integrations = integrationsResp?.data || []

  const getConfigured = (provider) => integrations.find(i => i.provider === provider)

  const handleEdit = (providerKey) => {
    const existing = getConfigured(providerKey)
    const fields = providers[providerKey]?.fields || []
    const vals = {}
    fields.forEach(f => { vals[f.key] = existing?.credentials?.[f.key] || '' })
    setFormValues(vals)
    setEditProvider(providerKey)
    setShowPasswords({})
  }

  const handleSave = async () => {
    try {
      await saveIntegration({ provider: editProvider, credentials: formValues }).unwrap()
      toast('Integration saved successfully', 'success')
      setEditProvider(null)
    } catch (err) {
      toast(err.data?.message || 'Failed to save integration', 'error')
    }
  }

  const handleDelete = async (provider) => {
    if (!confirm(`Remove ${providers[provider]?.label || provider} integration? This will delete all stored credentials.`)) return
    try {
      await deleteIntegration(provider).unwrap()
      toast('Integration removed', 'success')
    } catch {
      toast('Failed to remove', 'error')
    }
  }

  const handleTest = async (provider) => {
    setTestingProvider(provider)
    try {
      await testIntegration(provider).unwrap()
      toast('Connection test passed ✓', 'success')
    } catch {
      toast('Connection test failed', 'error')
    }
    setTestingProvider(null)
  }

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <Loader2 size={32} className="text-primary animate-spin inline-block" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-base font-bold text-[var(--vz-heading)]">Integrations</h5>
          <p className="text-xs text-[var(--vz-text-muted)]">Connect your calling, WhatsApp, payment, and storage providers</p>
        </div>
        <Button size="sm" variant="soft-primary" onClick={() => {
          const csvContent = [
            ['Category','Key / Variable','Default / Example','Required','Description','Where to Get'],
            ['MongoDB','MONGO_URI_AUTH','mongodb://localhost:27017/sparkcrm_auth','YES','Auth service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_TENANTS','mongodb://localhost:27017/sparkcrm_tenants','YES','Tenant service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_LEADS','mongodb://localhost:27017/sparkcrm_leads','YES','Lead service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_CALLS','mongodb://localhost:27017/sparkcrm_calls','YES','Call service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_WHATSAPP','mongodb://localhost:27017/sparkcrm_whatsapp','YES','WhatsApp service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_AUTOMATIONS','mongodb://localhost:27017/sparkcrm_automations','YES','Automation service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_BILLING','mongodb://localhost:27017/sparkcrm_billing','YES','Billing service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_NOTIFICATIONS','mongodb://localhost:27017/sparkcrm_notifications','YES','Notification service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_FORMS','mongodb://localhost:27017/sparkcrm_forms','YES','Form service database','Local MongoDB or Atlas'],
            ['MongoDB','MONGO_URI_MEETINGS','mongodb://localhost:27017/sparkcrm_meetings','YES','Meeting service database','Local MongoDB or Atlas'],
            ['JWT','JWT_SECRET','(generate 64-char hex)','YES','JWT signing secret','node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'],
            ['JWT','JWT_EXPIRES_IN','7d','YES','Access token expiry','7d recommended'],
            ['JWT','JWT_REFRESH_SECRET','(generate 64-char hex)','YES','Refresh token signing secret','Same as above'],
            ['Encryption','CREDENTIAL_ENCRYPTION_KEY','(32-char key)','YES','AES-256 key for API keys','Generate custom 32-char string'],
            ['Exotel','EXOTEL_API_KEY','(SID)','NO','Exotel API SID','Exotel Dashboard → Settings → API'],
            ['Exotel','EXOTEL_API_TOKEN','(token)','NO','Exotel API secret','Exotel Dashboard → Settings → API'],
            ['Exotel','EXOTEL_SUBDOMAIN','(subdomain)','NO','Exotel subdomain','Exotel Dashboard'],
            ['Twilio','TWILIO_ACCOUNT_SID','AC...','NO','Twilio Account SID','console.twilio.com'],
            ['Twilio','TWILIO_AUTH_TOKEN','(token)','NO','Twilio Auth Token','console.twilio.com'],
            ['WhatsApp','WHATSAPP_PHONE_NUMBER_ID','(ID)','NO','Phone Number ID','Meta Developer Console'],
            ['WhatsApp','WHATSAPP_ACCESS_TOKEN','(token)','NO','Permanent Access Token','Meta Business Settings → System Users'],
            ['WhatsApp','WHATSAPP_VERIFY_TOKEN','(custom string)','NO','Webhook verify token','Set same in Meta webhook settings'],
            ['Razorpay','RAZORPAY_KEY_ID','(key id)','NO','Razorpay Key ID','dashboard.razorpay.com → API Keys'],
            ['Razorpay','RAZORPAY_KEY_SECRET','(secret)','NO','Razorpay Key Secret','dashboard.razorpay.com → API Keys'],
            ['SMTP','SMTP_HOST','smtp.gmail.com','NO','SMTP server host','Email provider'],
            ['SMTP','SMTP_PORT','465','NO','SMTP server port','465 SSL / 587 TLS'],
            ['SMTP','SMTP_USER','(email)','NO','SMTP username','Your email'],
            ['SMTP','SMTP_PASS','(app password)','NO','SMTP password','For Gmail: App Passwords'],
            ['AWS S3','AWS_ACCESS_KEY_ID','(key)','NO','IAM access key','AWS IAM Console'],
            ['AWS S3','AWS_SECRET_ACCESS_KEY','(secret)','NO','IAM secret key','AWS IAM Console'],
            ['AWS S3','AWS_S3_BUCKET','sparkcrm-uploads','NO','S3 bucket name','AWS S3 Console'],
            ['Frontend','VITE_API_URL','http://localhost:4000','YES','API Gateway URL','Your gateway URL'],
          ].map(r => r.map(c => `"${(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
          const blob = new Blob([csvContent], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = 'SparkCRM_Project_Requirements.csv'; a.click()
          URL.revokeObjectURL(url)
          toast('Requirements CSV downloaded', 'success')
        }}>
          <ExternalLink size={14} className="mr-1.5" /> Download Requirements CSV
        </Button>
      </div>

      {/* ── Calling — Read-only info card (managed by SparkCRM admin) ── */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/8 border border-blue-500/20 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <PhoneCall size={20} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h6 className="text-sm font-bold text-[var(--vz-heading)]">Calling (Exotel / Twilio)</h6>
            <Badge color="soft-primary">Admin Managed</Badge>
          </div>
          <p className="text-[12px] text-[var(--vz-text-muted)] leading-relaxed">
            Click-to-call and inbound calling is configured by your SparkCRM administrator.
            Your team will be assigned virtual numbers from the organization's telephony pool.
            Contact your admin to enable or change your calling setup.
          </p>
        </div>
        <Info size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(providers)
          // Guard: never show calling providers even if they somehow slip through the backend
          .filter(([key]) => !['exotel', 'twilio'].includes(key))
          .map(([key, provider]) => {
          const Icon = PROVIDER_ICONS[key] || Plug
          const color = PROVIDER_COLORS[key] || '#6366f1'
          const configured = getConfigured(key)
          const isEditing = editProvider === key

          return (
            <Card key={key} className={`!p-0 overflow-hidden transition-all duration-200 ${isEditing ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-center gap-4 p-5 border-b border-[var(--vz-border)]">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${color}15` }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h6 className="text-sm font-bold text-[var(--vz-heading)]">{provider.label}</h6>
                    {configured && (
                      <Badge color={configured.isActive ? 'success' : 'warning'}>
                        {configured.isActive ? 'Connected' : 'Inactive'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--vz-text-muted)] truncate">{provider.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  {configured && (
                    <>
                      <button
                        onClick={() => handleTest(key)}
                        disabled={testingProvider === key}
                        className="p-2 rounded-lg text-info hover:bg-info/10 transition-colors"
                        title="Test Connection"
                      >
                        {testingProvider === key ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(key)}
                        className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                        title="Remove Integration"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => isEditing ? setEditProvider(null) : handleEdit(key)}
                    className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-primary text-white' : 'text-primary hover:bg-primary/10'}`}
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="p-5 space-y-4 bg-[var(--vz-body-bg)]/50">
                  {provider.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-[var(--vz-heading)] mb-1.5">
                        {field.label}
                        {field.required && <span className="text-danger ml-0.5">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                          placeholder={field.helpText || `Enter ${field.label}`}
                          value={formValues[field.key] || ''}
                          onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] outline-none focus:border-primary transition-colors pr-10"
                        />
                        {field.type === 'password' && (
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, [field.key]: !showPasswords[field.key] })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vz-text-muted)] hover:text-primary"
                          >
                            {showPasswords[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                      {field.helpText && (
                        <p className="text-[10px] text-[var(--vz-text-muted)] mt-1">{field.helpText}</p>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--vz-border)]">
                    <Button variant="ghost" size="sm" onClick={() => setEditProvider(null)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</> : <><Save size={14} className="mr-1" /> Save Credentials</>}
                    </Button>
                  </div>
                </div>
              )}

              {configured && configured.lastTestedAt && !isEditing && (
                <div className="px-5 py-2.5 bg-[var(--vz-body-bg)]/30 border-t border-[var(--vz-border)]">
                  <p className="text-[10px] text-[var(--vz-text-muted)]">
                    Last tested: {new Date(configured.lastTestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    <span className={configured.lastTestStatus === 'success' ? 'text-success font-bold' : 'text-danger font-bold'}>
                      {configured.lastTestStatus === 'success' ? '✓ Passed' : '✗ Failed'}
                    </span>
                  </p>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {Object.keys(providers).length === 0 && (
        <EmptyState icon={Plug} title="No Providers Available" description="Integration provider definitions could not be loaded." />
      )}
    </div>
  )
}
