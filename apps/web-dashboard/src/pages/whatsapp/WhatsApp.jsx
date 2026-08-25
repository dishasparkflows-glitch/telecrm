import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useSocketEvent } from '../../hooks/useSocketEvent'
import { ROLES } from '../../utils/constants'
import { whatsappApi, useGetChatQuery, useSendMessageMutation, useReplyToMessageMutation, useBroadcastMutation, useGetTemplatesQuery, useGetApprovedTemplatesQuery, useCreateTemplateMutation, useUpdateTemplateMutation, useDeleteTemplateMutation, useGetChatbotRulesQuery, useCreateChatbotRuleMutation, useUpdateChatbotRuleMutation, useDeleteChatbotRuleMutation, useSyncTemplatesMutation, useGetWhatsAppConfigQuery, useGetWhatsAppStatsQuery, useGetQRStatusQuery, useQrConnectMutation, useQrDisconnectMutation, flattenMessage } from '../../features/whatsapp/whatsappApi'
import { useGetActiveLeadsQuery, useGetLeadQuery } from '../../features/leads/leadApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Tabs from '../../components/ui/Tabs'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import ChatComposer from '../../components/whatsapp/ChatComposer'
import MessageMedia from '../../components/whatsapp/MessageMedia'
import MessageActions from '../../components/whatsapp/MessageActions'
import Select from '../../components/ui/Select'
import { MessageSquare, Search, Bot, FileText, Plus, Pencil, Trash2, Megaphone, Users, CheckCircle2, RefreshCw, Lock, AlertCircle, Variable, Eye, Info, Check, Clock, X, Phone, ChevronDown, QrCode, Wifi, WifiOff, Smartphone, LogOut, Loader2, MoreVertical } from 'lucide-react'

// ── WhatsApp QR Connect Panel (Baileys) ───────────────────────────────────────
// Shown to each agent when the tenant is in QR mode.
// Socket.IO uses the gateway in production and the Vite gateway proxy in development.
const WA_SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin

function QRConnectPanel() {
  const toast = useToast()
  const [qrImage, setQrImage] = useState(null)      // base64 PNG QR code
  const [wsStatus, setWsStatus] = useState('idle')  // idle | connecting | qr_pending | connected | reconnecting
  const [connectedPhone, setConnectedPhone] = useState(null)
  const { data: statusResp, refetch: refetchStatus } = useGetQRStatusQuery(undefined, {
    pollingInterval: wsStatus === 'connected' ? 60000 : 5000,
    skipPollingIfUnfocused: true,
  })
  const [qrConnect, { isLoading: connecting }] = useQrConnectMutation()
  const [qrDisconnect, { isLoading: disconnecting }] = useQrDisconnectMutation()
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)

  const serverStatus = statusResp?.data?.status
  const serverPhone  = statusResp?.data?.phone
  const serverQR     = statusResp?.data?.qr

  
  
  // Use global socket event hooks
  useSocketEvent('connect_error', (error) => {
    setWsStatus('idle')
    toast(error.message || 'Unable to connect to WhatsApp updates', 'error')
  })

  useSocketEvent('wa:qr', ({ qr }) => {
    setQrImage(qr)
    setWsStatus('qr_pending')
  })

  useSocketEvent('wa:connected', ({ phone }) => {
    setQrImage(null)
    setWsStatus('connected')
    setConnectedPhone(phone)
    toast(`WhatsApp connected! Number: ${phone}`, 'success')
    refetchStatus()
  })

  useSocketEvent('wa:reconnecting', () => {
    setWsStatus('reconnecting')
  })

  useSocketEvent('wa:disconnected', ({ reason }) => {
    setQrImage(null)
    setWsStatus('idle')
    setConnectedPhone(null)
    toast(reason === 'logged_out' ? 'WhatsApp logged out from your phone' : 'WhatsApp disconnected', 'warning')
    refetchStatus()
  })

  // If server already has an active session, reflect that
  useEffect(() => {
    if (!serverStatus) return
    queueMicrotask(() => {
      if (serverStatus === 'connected' && serverPhone) {
        setWsStatus('connected')
        setConnectedPhone(serverPhone)
      } else if (serverStatus === 'qr_pending') {
        setWsStatus('qr_pending')
        if (serverQR) setQrImage(serverQR)
      } else if (serverStatus === 'connecting' || serverStatus === 'reconnecting') {
        setWsStatus(serverStatus)
      } else if (serverStatus === 'disconnected') {
        setWsStatus('idle')
        setQrImage(null)
      }
    })
  }, [serverStatus, serverPhone, serverQR])

  const handleConnect = async () => {
    try {
      setWsStatus('connecting')
      setQrImage(null)
      await qrConnect().unwrap()
      refetchStatus()
    } catch (err) {
      toast(err?.data?.message || 'Failed to start connection', 'error')
      setWsStatus('idle')
    }
  }

  const handleDisconnect = async () => {
    if (!disconnectConfirm) return
    try {
      await qrDisconnect().unwrap()
      setQrImage(null)
      setWsStatus('idle')
      setConnectedPhone(null)
      toast('WhatsApp disconnected', 'success')
      refetchStatus()
      setDisconnectConfirm(false)
    } catch {
      toast('Failed to disconnect', 'error')
    }
  }

  const isConnected    = wsStatus === 'connected'
  const isQRPending    = wsStatus === 'qr_pending'
  const isConnecting   = wsStatus === 'connecting' || connecting

  return (
    <Card className="flex flex-col items-center justify-center p-4 text-center">
      <div className="flex justify-between items-start w-full mb-2">
        <p className="text-[11px] font-bold text-[var(--vz-heading)]">WhatsApp Connection</p>
        <button className="text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)]"><MoreVertical size={14} /></button>
      </div>

      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
        isConnected ? 'bg-emerald-100 text-emerald-500' : isQRPending ? 'bg-amber-100 text-amber-500' : 'bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)]'
      }`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
     </div>

      <p className="text-xs font-semibold text-[var(--vz-heading)] mb-1">My WhatsApp Connection</p>
      
      <div className="flex items-center gap-1.5 mb-2">
        {isConnected ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
            Connected
          </span>
        ) : isQRPending ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
            Scan QR
          </span>
        ) : isConnecting ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)]">
            <Loader2 size={10} className="animate-spin" /> Connecting...
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)]">
            Disconnected
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--vz-text-muted)] mb-4">
        {isConnected ? `+${connectedPhone || serverPhone}` : 'Not connected'}
      </p>

      {isConnected && (
        <div className="flex items-center gap-2 text-[10px] mb-4">
          <span className="text-[var(--vz-text-muted)]">Quality</span>
          <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Good</span>
        </div>
      )}

      {/* QR code image area */}
      {isQRPending && qrImage && (
        <div className="mt-2 w-full flex flex-col items-center gap-3">
          <div className="p-2 bg-white rounded-xl shadow-sm border border-[var(--vz-border)] inline-block">
            <img src={qrImage} alt="WhatsApp QR Code" className="w-32 h-32" />
          </div>
          <p className="text-[10px] text-[var(--vz-text-muted)] italic">QR expires in ~60s</p>
          <Button size="sm" variant="ghost" onClick={handleConnect} disabled={connecting} className="w-full text-[10px]">
            <RefreshCw size={12} className="mr-1" /> Refresh QR
          </Button>
        </div>
      )}

      {/* Action buttons */}
      {!isQRPending && (
        <div className="w-full mt-2">
          {isConnected ? (
            <Button size="sm" variant="outline" onClick={() => setDisconnectConfirm(true)} disabled={disconnecting} className="w-full text-danger border-danger/30 hover:bg-danger/10">
              {disconnecting ? <Loader2 size={13} className="animate-spin mr-1" /> : <LogOut size={13} className="mr-1" />}
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={handleConnect} disabled={isConnecting} className="w-full">
              {isConnecting ? <><Loader2 size={13} className="animate-spin mr-1" /> Starting...</> : <><QrCode size={13} className="mr-1" /> Connect</>}
            </Button>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={disconnectConfirm}
        title="Disconnect WhatsApp?"
        message="Are you sure you want to disconnect your WhatsApp from this CRM?"
        confirmText="Disconnect"
        variant="danger"
        loading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectConfirm(false)}
      />
    </Card>
  )
}

function WhatsAppSidebar({ setActiveTab, tenantMode, user }) {
  const { data: statsData, isLoading } = useGetWhatsAppStatsQuery(undefined, {
    refetchOnMountOrArgChange: true
  });
  
  const stats = statsData?.data || { used: 0, total: 2000, resetDate: new Date() };
  const used = stats.used;
  const total = stats.total;
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  const remaining = Math.max(0, total - used);
  
  const resetDateString = new Date(stats.resetDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  
  return (
    <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto">
      {/* 1. Connection Card */}
      {tenantMode === 'qr' && user?._id && (
        <QRConnectPanel />
      )}

      {/* 2. Usage Card */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-6">
          <p className="text-[11px] font-bold text-[var(--vz-heading)]">WhatsApp Usage</p>
          <div className="px-2 py-1 text-[10px] font-medium bg-[var(--vz-input-bg)] rounded text-[var(--vz-heading)] flex items-center gap-1 cursor-pointer">
            This Month <ChevronDown size={10} />
          </div>
        </div>
        
        {/* Gauge */}
        <div className="relative w-40 h-20 mx-auto flex justify-center overflow-hidden mb-2">
          <svg className="w-full h-full absolute top-0 left-0" viewBox="0 0 200 100">
            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" className="text-[var(--vz-border)]" />
            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" className="text-emerald-500 transition-all duration-1000 ease-out" 
              strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * percentage) / 100} />
          </svg>
          <div className="absolute bottom-0 text-center w-full">
            <p className="text-2xl font-bold text-[var(--vz-heading)] leading-none">{used.toLocaleString()}</p>
            <p className="text-[9px] text-[var(--vz-text-muted)] mt-1 font-medium">of {total.toLocaleString()} messages</p>
          </div>
        </div>
        
        <div className="flex justify-center mb-4">
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{percentage}% used</span>
        </div>
        
        <div className="bg-primary/5 rounded-lg border border-primary/10 p-2.5 flex items-center justify-center gap-2 mb-3">
          <MessageSquare size={12} className="text-primary" />
          <span className="text-[11px] font-semibold text-primary">{remaining.toLocaleString()} messages remaining</span>
        </div>
        
        <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--vz-text-muted)]">
          Resets on {resetDateString} <Info size={10} />
        </div>
      </Card>

    </div>
  )
}

// ── Helper: detect {{N}} variables in body text ──────────────────────────────
function parseVariables(bodyText) {
  const matches = [...new Set((bodyText || '').match(/\{\{(\d+)\}\}/g) || [])]
  return matches
    .map(m => parseInt(m.replace(/[{}]/g, '')))
    .sort((a, b) => a - b)
    .map(index => ({ index, label: '', example: '', field: '' }))
}

// Available lead fields for variable mapping
const LEAD_FIELDS = [
  { value: 'firstName',   label: 'First Name' },
  { value: 'lastName',    label: 'Last Name' },
  { value: 'company',     label: 'Company' },
  { value: 'email',       label: 'Email' },
  { value: 'phone',       label: 'Phone' },
  { value: 'city',        label: 'City' },
  { value: 'source',      label: 'Lead Source' },
]

// ── Reusable Template Form ────────────────────────────────────────────────────
function TemplateForm({ form, onChange }) {
  const handleBodyChange = (e) => {
    const body = e.target.value
    const newVars = parseVariables(body)
    const merged = newVars.map(nv => {
      const existing = (form.variables || []).find(v => v.index === nv.index)
      return existing ? { ...nv, ...existing } : nv
    })
    onChange({ ...form, content: { ...(form.content || {}), body }, variables: merged })
  }

  const updateVar = (index, field, value) => {
    const vars = (form.variables || []).map(v =>
      v.index === index ? { ...v, [field]: value } : v
    )
    onChange({ ...form, variables: vars })
  }

  // Build the same bold-variable preview with React nodes so template text
  // always remains text and can never be interpreted as executable HTML.
  const preview = (form.content?.body || '').split(/(\{\{\d+\}\})/g).map((part, index) => {
    const match = part.match(/^\{\{(\d+)\}\}$/)
    if (!match) return part

    const variableIndex = Number(match[1])
    const variable = (form.variables || []).find(x => x.index === variableIndex)
    const value = variable?.example || (variable?.label ? `[${variable.label}]` : part)
    return <strong key={`${variableIndex}-${index}`}>{value}</strong>
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Template Name" value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} placeholder="e.g. welcome_message" />
        <div className="space-y-1">
          <Select
            label="Language"
            value={form.language || 'en'}
            onChange={val => onChange({ ...form, language: val })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'Hindi' },
              { value: 'mr', label: 'Marathi' },
              { value: 'gu', label: 'Gujarati' },
              { value: 'ta', label: 'Tamil' }
            ]}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-[var(--vz-heading)] flex items-center gap-2">
          Body Text
          <span className="text-[10px] font-normal text-[var(--vz-text-muted)] bg-[var(--vz-input-bg)] px-2 py-0.5 rounded-full border border-[var(--vz-border)]">
            Use &#123;&#123;1&#125;&#125; &#123;&#123;2&#125;&#125; for variables
          </span>
        </label>
        <textarea
          value={form.content?.body || ''}
          onChange={handleBodyChange}
          className="w-full p-3 border border-[var(--vz-border)] rounded-lg bg-[var(--vz-input-bg)] text-[var(--vz-text)] text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y font-mono"
          placeholder={`Hello {{1}},\n\nYour appointment at {{2}} is confirmed for {{3}}.`}
        />
      </div>

      {/* Live preview */}
      {form.content?.body && (
        <div className="p-3 rounded-lg bg-[#e7fbd4] border border-green-200">
          <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1 flex items-center gap-1"><Eye size={10}/> Preview</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{preview}</p>
        </div>
      )}

      {/* Variable definitions */}
      {(form.variables || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--vz-heading)] flex items-center gap-2">
            <Variable size={14} className="text-primary" />
            Variable Definitions
            <span className="text-[10px] font-normal text-[var(--vz-text-muted)]">(Meta requires sample values for approval)</span>
          </p>
          <div className="space-y-2">
            {(form.variables || []).map(v => (
              <div key={v.index} className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[var(--vz-input-bg)] border border-[var(--vz-border)]">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">&#123;&#123;{v.index}&#125;&#125;</span>
                  <span className="text-xs text-[var(--vz-text-muted)]">Variable {v.index}</span>
                </div>
                <input
                  value={v.label}
                  onChange={e => updateVar(v.index, 'label', e.target.value)}
                  placeholder="Label (e.g. Customer Name)"
                  className="px-2 py-1.5 text-xs rounded-md border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-[var(--vz-text)] focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <input
                  value={v.example}
                  onChange={e => updateVar(v.index, 'example', e.target.value)}
                  placeholder="Sample (e.g. John)"
                  className="px-2 py-1.5 text-xs rounded-md border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-[var(--vz-text)] focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <Info size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-600">WhatsApp requires sample values to review your template. Label is for your reference only.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Select
            label="Category"
            value={form.category || 'utility'}
            onChange={val => onChange({ ...form, category: val })}
            options={[
              { value: 'utility', label: 'Utility' },
              { value: 'marketing', label: 'Marketing' },
              { value: 'authentication', label: 'Authentication' }
            ]}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--vz-heading)]">Footer (optional)</label>
          <input value={form.content?.footer || ''} onChange={e => onChange({ ...form, content: { ...(form.content || {}), footer: e.target.value } })}
            placeholder="e.g. SparkCRM Team"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--vz-border)] bg-[var(--vz-input-bg)] text-[var(--vz-text)] focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
    </div>
  )
}


export default function WhatsApp() {
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const location = useLocation()
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN

  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes('/broadcasts')) return 'broadcasts'
    return searchParams.get('tab') || 'chat'
  })
  const [selectedLead, setSelectedLead] = useState(searchParams.get('lead') || null)
  const [message, setMessage] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [chatSearch, setChatSearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [leadsPage, setLeadsPage] = useState(1)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [showEditTemplate, setShowEditTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', content: { body: '', headertype: 'none', headercontent: '', footer: '' }, category: 'utility', language: 'en', variables: [] })
  const [editTemplateForm, setEditTemplateForm] = useState(null)
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [showEditRule, setShowEditRule] = useState(false)
  const [ruleForm, setRuleForm] = useState({ rule: { triggerKeyword: '', responseContent: '' }, isActive: true })
  const [editRuleForm, setEditRuleForm] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [deleteTemplateId, setDeleteTemplateId] = useState(null)
  const [deleteRuleId, setDeleteRuleId] = useState(null)
  
  // Broadcasts
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [variableMapping, setVariableMapping] = useState({})
  const [broadcastLoading, setBroadcastLoading] = useState(false)

  // Chat template picker
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const { data: leadsData, isFetching: isLeadsFetching } = useGetActiveLeadsQuery({ page: leadsPage, limit: 15, search: contactSearch })
  const { data: selectedLeadData } = useGetLeadQuery(selectedLead, { skip: !selectedLead })
  const { data: chatData } = useGetChatQuery(selectedLead, {
    skip: !selectedLead,
    pollingInterval: 10000, // Socket.IO is primary; polling is the consistency fallback
    skipPollingIfUnfocused: true,
  })
  const { data: templatesData } = useGetTemplatesQuery(undefined, {
    skip: activeTab !== 'templates',
  })
  const { data: approvedTemplatesData, isFetching: isApprovedFetching } = useGetApprovedTemplatesQuery(undefined, {
    skip: activeTab !== 'broadcasts' && !showTemplatePicker,
  })
  const { data: chatbotData } = useGetChatbotRulesQuery(undefined, {
    skip: activeTab !== 'chatbot',
  })
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation()
  const [replyToMessage, { isLoading: replying }] = useReplyToMessageMutation()
  const [createTemplate] = useCreateTemplateMutation()
  const [updateTemplate] = useUpdateTemplateMutation()
  const [deleteTemplate, { isLoading: isDeletingTemplate }] = useDeleteTemplateMutation()
  const [createRule] = useCreateChatbotRuleMutation()
  const [updateRule] = useUpdateChatbotRuleMutation()
  const [deleteRule, { isLoading: isDeletingRule }] = useDeleteChatbotRuleMutation()
  const [sendBroadcast] = useBroadcastMutation()
  const [syncTemplates] = useSyncTemplatesMutation()

  const leads = useMemo(() => leadsData?.data || [], [leadsData?.data])
  const messages = useMemo(() => chatData?.data || [], [chatData?.data])
  const templates = templatesData?.data || []
  const approvedTemplates = approvedTemplatesData?.data || []
  const chatbotRules = chatbotData?.data || []

  // Message events use the same authenticated per-agent Socket.IO room as QR
  // updates. Polling remains enabled above as a consistency fallback.
  useSocketEvent('wa:message', ({ message: incoming }) => {
    if (!incoming?._id) return
    const flatMsg = flattenMessage(incoming)
    const incomingPhone = String(flatMsg.direction === 'inbound' ? flatMsg.from : flatMsg.to).replace(/\D/g, '')
    const matchedLead = flatMsg.leadId
      ? String(flatMsg.leadId)
      : leads.find((lead) => {
          const leadPhone = String(lead.contact?.phone || '').replace(/\D/g, '')
          return leadPhone && (leadPhone === incomingPhone || leadPhone.endsWith(incomingPhone) || incomingPhone.endsWith(leadPhone))
        })?._id

    if (matchedLead) {
      dispatch(whatsappApi.util.updateQueryData('getChat', matchedLead, (draft) => {
        if (!Array.isArray(draft?.data)) return
        const index = draft.data.findIndex((item) => item._id === flatMsg._id)
        if (index >= 0) draft.data[index] = flatMsg
        else draft.data.push(flatMsg)
        draft.data.sort((a, b) => new Date(a.meta?.createdAt) - new Date(b.meta?.createdAt))
      }))
    }
    dispatch(whatsappApi.util.invalidateTags([{ type: 'WhatsApp', id: 'INBOX' }]))
  });

  // Auto-scroll to newest message when chat opens or new message arrives
  const messagesEndRef = useRef(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const displayedMessages = chatSearch.trim()
    ? messages.filter((item) => `${item.content || ''} ${item.mediaName || ''}`.toLowerCase().includes(chatSearch.trim().toLowerCase()))
    : messages
  const actionContacts = leads.map((lead) => {
    const fullPhone = lead.contact?.countryCode && lead.contact?.phone 
      ? `${lead.contact.countryCode}${lead.contact.phone}` 
      : lead.contact?.phone;
    return { id: lead._id, name: `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim(), phone: fullPhone };
  })

  const filteredLeads = leads;

  // Resolve template body for a specific lead (fill {{N}} from lead fields)
  const resolveTemplate = useCallback((template, lead) => {
    if (!template || !lead) return template?.content?.body || ''
    let body = template.content?.body || ''
    ;(template.variables || []).forEach(v => {
      const fieldVal = lead[v.field] || v.example || `{{${v.index}}}`
      body = body.replace(new RegExp(`\\{\\{${v.index}\\}\\}`, 'g'), fieldVal)
    })
    return body
  }, [])

  const handleSend = async () => {
    if (!message.trim() || !selectedLead) return
    const lead = leads.find(l => l._id === selectedLead)
    if (!lead?.contact?.phone) return toast('This lead has no phone number on record', 'error')
    
    const fullPhone = lead.contact?.countryCode && lead.contact?.phone 
      ? `${lead.contact.countryCode}${lead.contact.phone}` 
      : lead.contact?.phone

    try {
      const result = replyingTo
        ? await replyToMessage({ id: replyingTo._id, to: fullPhone, leadId: selectedLead, type: 'text', content: message }).unwrap()
        : await sendMessage({ leadId: selectedLead, to: fullPhone, content: message }).unwrap()
      setMessage('')
      setReplyingTo(null)
      // Show warning if message was queued (config not set up)
      if (result?.data?.status === 'queued') {
        toast('Message saved but not sent — check WhatsApp Setup in Settings', 'warning')
      }
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Failed to send message'
      toast(msg, 'error')
    }
  }

  const handleSendMedia = async (media) => {
    const lead = leads.find((item) => item._id === selectedLead)
    if (!lead?.contact?.phone) throw new Error('This lead has no phone number')
    
    const fullPhone = lead.contact?.countryCode && lead.contact?.phone 
      ? `${lead.contact.countryCode}${lead.contact.phone}` 
      : lead.contact?.phone

    const result = replyingTo
      ? await replyToMessage({ id: replyingTo._id, to: fullPhone, leadId: selectedLead, ...media }).unwrap()
      : await sendMessage({ leadId: selectedLead, to: fullPhone, ...media }).unwrap()
    setReplyingTo(null)
    if (result?.data?.status === 'failed') throw new Error(result?.data?.lastError || 'Media delivery failed')
  }

  const handleSendTemplate = async (template) => {
    const lead = leads.find(l => l._id === selectedLead)
    if (!lead?.contact?.phone) return toast('This lead has no phone number', 'error')
    const resolvedBody = resolveTemplate(template, lead)
    
    const fullPhone = lead.contact?.countryCode && lead.contact?.phone 
      ? `${lead.contact.countryCode}${lead.contact.phone}` 
      : lead.contact?.phone

    try {
      const result = await sendMessage({
        leadId: selectedLead,
        to: fullPhone,
        content: resolvedBody,
        type: 'template',
        templateName: template.name,
        languageCode: template.language || 'en',
      }).unwrap()
      setShowTemplatePicker(false)
      if (result?.data?.status === 'queued') {
        toast('Template saved but not sent — check WhatsApp Setup in Settings', 'warning')
      } else {
        toast('Template message sent', 'success')
      }
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Failed to send template'
      toast(msg, 'error')
    }
  }

  // Templates
  const handleCreateTemplate = async () => {
    try {
      await createTemplate(templateForm).unwrap()
      toast('Template submitted for WhatsApp approval', 'success')
      setShowCreateTemplate(false)
      setTemplateForm({ name: '', content: { body: '', headertype: 'none', headercontent: '', footer: '' }, category: 'utility', language: 'en', variables: [] })
    } catch (e) { toast(e?.data?.message || 'Failed to create template', 'error') }
  }

  const handleEditTemplateOpen = (t) => {
    setEditTemplateForm({
      id: t._id, name: t.name, content: t.content || { body: '', headertype: 'none', headercontent: '', footer: '' }, category: t.category,
      language: t.language, variables: t.variables || []
    })
    setShowEditTemplate(true)
  }

  const handleUpdateTemplate = async () => {
    try {
      await updateTemplate(editTemplateForm).unwrap()
      toast('Template updated', 'success')
      setShowEditTemplate(false)
    } catch (e) { toast(e?.data?.message || 'Failed to update template', 'error') }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return
    if (!isSuperAdmin) return toast('Only administrators can delete templates', 'error')
    try {
      await deleteTemplate(deleteTemplateId).unwrap()
      toast('Template deleted', 'success')
      setDeleteTemplateId(null)
    } catch { toast('Failed to delete template', 'error') }
  }

  const handleSyncTemplates = async () => {
    setSyncing(true)
    try {
      const result = await syncTemplates().unwrap()
      toast(`Synced ${result.data?.synced || 0} templates from Meta`, 'success')
    } catch (e) {
      toast(e?.data?.message || 'Sync failed — check WhatsApp integration settings', 'error')
    } finally { setSyncing(false) }
  }

  // Rules
  const handleCreateRule = async () => {
    try {
      await createRule(ruleForm).unwrap()
      toast('Rule created', 'success')
      setShowCreateRule(false)
      setRuleForm({ rule: { triggerKeyword: '', responseContent: '' }, isActive: true })
    } catch { toast('Failed to create rule', 'error') }
  }

  const handleEditRuleOpen = (r) => {
    setEditRuleForm({ id: r._id, rule: { triggerKeyword: r.rule?.triggerKeyword || '', responseContent: r.rule?.responseContent || '' }, isActive: r.isActive ?? true })
    setShowEditRule(true)
  }

  const handleUpdateRule = async () => {
    try {
      await updateRule(editRuleForm).unwrap()
      toast('Rule updated', 'success')
      setShowEditRule(false)
    } catch { toast('Failed to update rule', 'error') }
  }

  const handleDeleteRule = async () => {
    if (!deleteRuleId) return
    try {
      await deleteRule(deleteRuleId).unwrap()
      toast('Rule deleted', 'success')
      setDeleteRuleId(null)
    } catch { toast('Failed to delete rule', 'error') }
  }

  // Broadcast
  const handleBroadcast = async () => {
    if (!selectedTemplate) return
    setBroadcastLoading(true)
    try {
      const recipients = leads.filter(l => l.contact?.phone).map(l => {
        const payload = {
          _id: l._id,
          leadId: l._id,
          phone: l.contact?.phone,
          countryCode: l.contact?.countryCode,
        }
        
        // Dynamically append only the fields needed for template variables
        ;(selectedTemplate.variables || []).forEach(v => {
          const field = variableMapping[String(v.index)] || v.field
          if (field === 'firstName') payload.firstName = l.contact?.firstName || ''
          if (field === 'lastName') payload.lastName = l.contact?.lastName || ''
          if (field === 'company') payload.company = l.contact?.company || ''
          if (field === 'email') payload.email = l.contact?.email || ''
          if (field === 'city') payload.city = l.address?.city || ''
          if (field === 'source') payload.source = l.source || ''
        })
        
        return payload
      })
      await sendBroadcast({
        templateId: selectedTemplate._id,
        variableMapping,
        recipients,
      }).unwrap()
      toast(`Broadcast sent to ${recipients.length} recipients`, 'success')
      setSelectedTemplate(null)
      setVariableMapping({})
    } catch (e) {
      toast(e?.data?.message || 'Broadcast failed', 'error')
    } finally { setBroadcastLoading(false) }
  }

  const tabs = [
    { key: 'chat', label: 'Chat', icon: MessageSquare },
    { key: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
    { key: 'templates', label: 'Templates', icon: FileText, count: templates.length },
    { key: 'chatbot', label: 'Chatbot', icon: Bot, count: chatbotRules.length },
  ]

  const { data: whatsappConfigResp } = useGetWhatsAppConfigQuery()
  const tenantMode = whatsappConfigResp?.data?.mode

  return (
    <>
      <PageHeader title="WhatsApp" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'WhatsApp' }]} />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />

      {activeTab === 'chat' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: 'calc(100vh - 210px)' }}>
          {/* Contact List */}
          <Card noPadding className="lg:col-span-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[var(--vz-border)]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
                <input type="text" placeholder="Search contacts..." value={contactSearch} onChange={(e) => { setContactSearch(e.target.value); setLeadsPage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-sm text-[var(--vz-heading)]
                    placeholder:text-[var(--vz-text-muted)] outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.target;
              if (scrollHeight - scrollTop <= clientHeight + 10 && !isLeadsFetching) {
                if (leadsData?.pagination?.page < leadsData?.pagination?.totalPages) {
                  setLeadsPage(p => p + 1);
                }
              }
            }}>
              {filteredLeads.length === 0 ? (
                <p className="text-center text-xs text-[var(--vz-text-muted)] py-8">No leads with phone numbers</p>
              ) : filteredLeads.map((lead) => (
                <button key={lead._id} onClick={() => { setSelectedLead(lead._id); setShowTemplatePicker(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-[var(--vz-border)] text-left transition-colors
                    ${selectedLead === lead._id ? 'bg-primary/10' : 'hover:bg-[var(--vz-input-bg)]'}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {lead.contact?.firstName?.[0]}{lead.contact?.lastName?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--vz-heading)] truncate">{lead.contact?.firstName} {lead.contact?.lastName}</p>
                    <p className="text-xs text-[var(--vz-text-muted)] truncate flex items-center gap-1">
                      <Phone size={9} />{lead.contact?.phone || 'No phone'}
                    </p>
                  </div>
                  {!lead.contact?.phone && <AlertCircle size={12} className="text-warning shrink-0" />}
                </button>
              ))}
            </div>
          </Card>

          {/* Chat Window */}
          <Card noPadding className="lg:col-span-2 flex flex-col overflow-hidden">
            {!selectedLead ? (
              <EmptyState icon={MessageSquare} title="Select a contact" description="Choose a lead from the list to start chatting" />
            ) : (() => {
              const lead = selectedLeadData?.data || leads.find(l => l._id === selectedLead)
              return (
                <>
                  {/* Chat header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vz-border)] bg-[var(--vz-card-bg)]">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {lead?.contact?.firstName?.[0]}{lead?.contact?.lastName?.[0]}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-[var(--vz-card-bg)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--vz-heading)]">{lead?.contact?.firstName} {lead?.contact?.lastName}</p>
                        <p className="text-[11px] text-[var(--vz-text-muted)] flex items-center gap-1">
                          <Phone size={9} /> {lead?.contact?.phone || 'No phone number'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
                        <input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search chat"
                          className="w-36 pl-7 pr-2 py-1.5 text-xs rounded-lg border border-[var(--vz-border)] bg-[var(--vz-input-bg)] outline-none focus:border-primary" />
                      </div>
                    {!lead?.contact?.phone && (
                      <div className="flex items-center gap-1.5 text-[11px] text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
                        <AlertCircle size={11} /> No phone — messages will be queued
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{background:'var(--vz-body-bg)'}}>
                    {displayedMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <MessageSquare size={20} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--vz-heading)]">No messages yet</p>
                          <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">Start the conversation or use a template below</p>
                        </div>
                      </div>
                    ) : (
                      displayedMessages.map((msg) => {
                        const isOut = msg.direction === 'outbound'
                        // WhatsApp-style status ticks
                        const statusIcon = (msg.status === 'read' || msg.isRead || msg.whatsappReadAt)
                          ? <span className="flex" title="Read"><Check size={11} className="text-blue-300" /><Check size={11} className="text-blue-300 -ml-[5px]" /></span>
                          : (msg.status === 'delivered' || msg.deliveredAt)
                          ? <span className="flex" title="Delivered"><Check size={11} className="text-white/70" /><Check size={11} className="text-white/70 -ml-[5px]" /></span>
                          : (msg.status === 'sent' || msg.sentAt)
                          ? <Check size={11} className="text-white/70" title="Sent" />
                          : msg.status === 'queued'
                          ? <Clock size={11} className="text-white/50" title="Queued — WhatsApp not configured" />
                          : msg.status === 'failed'
                          ? <X size={11} className="text-red-300" title="Failed to send" />
                          : null
                        return (
                          <div id={`wa-message-${msg._id}`} key={msg._id} className={`group flex ${isOut ? 'justify-end' : 'justify-start'}`}> 
                            <div className={`relative max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm
                              ${isOut
                                ? 'bg-primary text-white rounded-br-md'
                                : 'bg-[var(--vz-card-bg)] text-[var(--vz-heading)] rounded-bl-md border border-[var(--vz-border)]'}`}>
                              <MessageActions message={msg} outgoing={isOut} contacts={actionContacts} onReply={setReplyingTo} toast={toast} />
                              {msg.isForwarded && <p className={`text-[10px] italic mb-1 ${isOut ? 'text-white/60' : 'text-[var(--vz-text-muted)]'}`}>Forwarded</p>}
                              {msg.replyTo?.snapshot && (
                                <button type="button" onClick={() => document.getElementById(`wa-message-${msg.replyTo.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                  className={`w-full text-left border-l-2 px-2 py-1.5 mb-1.5 rounded ${isOut ? 'border-white/60 bg-white/10' : 'border-primary bg-primary/5'}`}>
                                  <span className="block text-[10px] opacity-70">Reply</span>
                                  <span className="block text-xs truncate">{msg.replyTo.snapshot.content || msg.replyTo.snapshot.mediaName || msg.replyTo.snapshot.type}</span>
                                </button>
                              )}
                              {msg.templateName && (
                                <p className={`text-[10px] font-semibold mb-1 flex items-center gap-1 ${isOut ? 'text-white/70' : 'text-primary'}`}>
                                  <FileText size={9} /> {msg.templateName}
                                </p>
                              )}
                              {['image', 'video', 'audio', 'document'].includes(msg.type) && (
                                <MessageMedia message={msg} outgoing={isOut} />
                              )}
                              {(msg.content || msg.body || (typeof msg.message === 'string' && msg.message)) && (
                                <p className={`leading-relaxed ${msg.type !== 'text' ? 'mt-1.5' : ''}`}>{msg.content || msg.body || (typeof msg.message === 'string' ? msg.message : null)}</p>
                              )}
                              {msg.reactions?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">{msg.reactions.map((reaction, index) => <span key={`${reaction.emoji}-${index}`} className="px-1.5 py-0.5 rounded-full bg-black/10 text-sm">{reaction.emoji}</span>)}</div>
                              )}
                              <div className={`flex items-center justify-end gap-1 mt-1 ${isOut ? 'text-white/60' : 'text-[var(--vz-text-muted)]'} text-[10px]`}>
                                {new Date(msg.timestamp || msg.meta?.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOut && statusIcon}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                    {/* Scroll anchor — keeps chat pinned to bottom on new messages */}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Template Picker (expands above input bar) */}
                  {showTemplatePicker && (
                    <div className="border-t border-[var(--vz-border)] bg-[var(--vz-card-bg)] max-h-56 overflow-y-auto">
                      <div className="px-3 py-2 flex items-center justify-between border-b border-[var(--vz-border)]">
                        <p className="text-xs font-semibold text-[var(--vz-heading)] flex items-center gap-1.5"><FileText size={12} className="text-primary" /> Quick Templates</p>
                        <button onClick={() => setShowTemplatePicker(false)} className="text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)]"><ChevronDown size={14} /></button>
                      </div>
                      {isApprovedFetching ? (
                        <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-[var(--vz-text-muted)]" /></div>
                      ) : approvedTemplates.length === 0 ? (
                        <p className="text-xs text-[var(--vz-text-muted)] text-center py-4">No approved templates yet — create one in the Templates tab</p>
                      ) : (
                        approvedTemplates.map(t => {
                          const preview = resolveTemplate(t, lead)
                          return (
                            <button key={t._id} onClick={() => handleSendTemplate(t)}
                              className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b border-[var(--vz-border)] transition-colors group">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-[var(--vz-heading)] group-hover:text-primary">{t.name}</p>
                                <span className="text-[10px] text-[var(--vz-text-muted)] bg-[var(--vz-input-bg)] px-1.5 py-0.5 rounded">{t.category}</span>
                              </div>
                              <p className="text-[11px] text-[var(--vz-text-muted)] mt-0.5 line-clamp-2">{preview}</p>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}

                  {/* Input bar */}
                  <div className="p-3 border-t border-[var(--vz-border)] bg-[var(--vz-card-bg)]">
                    {replyingTo && (
                      <div className="mb-2 px-3 py-2 border-l-2 border-primary rounded-lg bg-primary/5 flex items-center justify-between">
                        <div className="min-w-0"><p className="text-[10px] font-semibold text-primary">Replying to</p><p className="text-xs truncate">{replyingTo.content || replyingTo.mediaName || replyingTo.type}</p></div>
                        <button type="button" onClick={() => setReplyingTo(null)} className="p-1 text-[var(--vz-text-muted)]"><X size={14} /></button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => setShowTemplatePicker(v => !v)}
                        title="Use a template"
                        className={`flex-shrink-0 mb-0.5 p-2 rounded-lg border transition-colors ${
                          showTemplatePicker
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-[var(--vz-border)] text-[var(--vz-text-muted)] hover:border-primary/40 hover:text-primary'
                        }`}>
                        <FileText size={15} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <ChatComposer
                          leadId={lead?._id || null}
                          value={message}
                          onChange={setMessage}
                          onSendText={handleSend}
                          onSendMedia={handleSendMedia}
                          sending={sending || replying}
                          disabled={!lead?.contact?.phone}
                          toast={toast}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </Card>

          {/* Right Sidebar */}
          <WhatsAppSidebar setActiveTab={setActiveTab} tenantMode={tenantMode} user={user} />
        </div>
        </>
      )}

      {activeTab === 'templates' && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <Card.Title>Message Templates</Card.Title>
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <Button size="sm" variant="ghost" onClick={handleSyncTemplates} disabled={syncing}>
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing...' : 'Sync from Meta'}
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button size="sm" onClick={() => setShowCreateTemplate(true)}><Plus size={14} /> Create Template</Button>
                )}
              </div>
            </div>
            {!isSuperAdmin && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Lock size={13} className="text-amber-500 flex-shrink-0" />
                <p className="text-[11px] text-amber-600">Template management is restricted to administrators. Contact your Super Admin to create or update templates.</p>
              </div>
            )}
          </Card.Header>
          {templates.length === 0 ? (
            <EmptyState icon={FileText} title="No templates" description="Create message templates for quick sends" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((t) => (
                <div key={t._id} className="p-3 rounded-lg border border-[var(--vz-border)] hover:border-primary/30 transition-colors group relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[var(--vz-heading)]">{t.name}</p>
                      <div className="flex items-center gap-1">
                        <Badge color={t.status === 'approved' ? 'success' : t.status === 'rejected' ? 'danger' : t.status === 'pending' ? 'warning' : 'dark'}>
                          {t.status === 'approved' ? '✓ Approved' : t.status === 'rejected' ? '✗ Rejected' : t.status === 'pending' ? '⏳ Pending' : t.status}
                        </Badge>
                        {isSuperAdmin && (
                          <>
                            <button onClick={() => handleEditTemplateOpen(t)} className="p-1 rounded hover:bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all"><Pencil size={12}/></button>
                            <button onClick={() => setDeleteTemplateId(t._id)} className="p-1 rounded hover:bg-danger/10 text-danger opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                          </>
                        )}
                      </div>
                    </div>
                  <p className="text-xs text-[var(--vz-text)] line-clamp-3">{t.content?.body}</p>
                  {t.variables?.length > 0 && (
                     <div className="flex flex-wrap gap-1 mt-2">
                       {t.variables.map(v => (
                         <span key={v.index} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-md border border-primary/20">
                           &#123;&#123;{v.index}&#125;&#125; {v.label && <span className="text-[9px] text-primary/70">{v.label}</span>}
                         </span>
                       ))}
                     </div>
                   )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'chatbot' && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <Card.Title>Chatbot Rules</Card.Title>
              {isSuperAdmin && (
                <Button size="sm" onClick={() => setShowCreateRule(true)}><Plus size={14} /> Add Rule</Button>
              )}
            </div>
            {!isSuperAdmin && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Lock size={13} className="text-amber-500 flex-shrink-0" />
                <p className="text-[11px] text-amber-600">Chatbot rule management is restricted to administrators.</p>
              </div>
            )}
          </Card.Header>
          {chatbotRules.length === 0 ? (
            <EmptyState icon={Bot} title="No chatbot rules" description="Configure auto-reply rules for incoming messages" />
          ) : (
            <div className="space-y-2">
              {chatbotRules.map((rule) => (
                <div key={rule._id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--vz-border)] hover:border-primary/30 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--vz-heading)]">{rule.rule?.triggerKeyword || '—'}</p>
                    <p className="text-xs text-[var(--vz-text-muted)] line-clamp-1">{rule.rule?.responseContent || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge color={(rule.isActive) ? 'success' : 'dark'}>{(rule.isActive) ? 'Active' : 'Inactive'}</Badge>
                    {isSuperAdmin && (
                      <>
                        <button onClick={() => handleEditRuleOpen(rule)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-all" title="Edit rule"><Pencil size={14}/></button>
                        <button onClick={() => setDeleteRuleId(rule._id)} className="p-1.5 rounded hover:bg-danger/10 text-danger transition-all" title="Delete rule"><Trash2 size={14}/></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'broadcasts' && (
        <>
          {!isSuperAdmin ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <Lock size={28} className="text-amber-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-[var(--vz-heading)] mb-1">Broadcast is Admin-Only</h3>
                  <p className="text-sm text-[var(--vz-text-muted)] max-w-sm">Only Super Admins can send broadcast messages to prevent accidental mass messaging. Contact your administrator to run a campaign.</p>
                </div>
              </div>
            </Card>
          ) : (
          <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Megaphone size={16} />
              </div>
              <div>
                <Card.Title>WhatsApp Broadcast</Card.Title>
                <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">Send a template message to multiple leads at once</p>
              </div>
            </div>
          </Card.Header>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--vz-heading)] flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20">STEP 1</span>
                  Select Template
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {approvedTemplates.length === 0 ? (
                    <div className="p-8 border border-dashed border-[var(--vz-border)] rounded-lg text-center bg-[var(--vz-input-bg)]/20">
                      <FileText size={24} className="mx-auto text-[var(--vz-text-muted)] mb-3 opacity-20" />
                      <p className="text-sm text-[var(--vz-text-muted)]">No approved templates found.</p>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('templates')} className="mt-2 font-medium">Create Template</Button>
                    </div>
                  ) : (
                    approvedTemplates.map(t => (
                      <button 
                        key={t._id}
                        onClick={() => setSelectedTemplate(t)}
                        className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                          selectedTemplate?._id === t._id 
                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary' 
                            : 'border-[var(--vz-border)] hover:bg-[var(--vz-input-bg)] hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-[var(--vz-heading)]">{t.name}</p>
                          {selectedTemplate?._id === t._id && <CheckCircle2 size={14} className="text-primary" />}
                        </div>
                        <p className="text-xs text-[var(--vz-text-muted)] line-clamp-2 leading-relaxed">{t.content?.body}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--vz-heading)] flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20">STEP 2</span>
                  Recipients Preview
                </label>
                <div className="p-5 rounded-xl bg-[var(--vz-card-bg)] border border-[var(--vz-border)] shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <Users size={24} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-[var(--vz-heading)]">{leads.filter(l => l.contact?.phone).length} Recipients</p>
                      <p className="text-xs text-[var(--vz-text-muted)]">All leads with valid phone numbers</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-warning/20 bg-warning/5 space-y-3">
                <div className="flex items-center gap-2 text-warning">
                  <Bot size={16} />
                  <p className="text-xs font-bold uppercase tracking-wider">Sending Strategy</p>
                </div>
                <p className="text-xs text-[var(--vz-text)] leading-loose opacity-80">
                  Broadcasts are throttled at <span className="font-bold">1 message per 2 seconds</span>. This staggered delivery helps maintain high delivery rates and protects your business number from Meta's automated flagging.
                </p>
              </div>

              <div className="pt-6">
                <Button 
                  className="w-full h-12 text-sm font-bold rounded-xl shadow-lg shadow-primary/20" 
                  disabled={!selectedTemplate || broadcastLoading || leads.filter(l => l.contact?.phone).length === 0} 
                  onClick={handleBroadcast}
                >
                  {broadcastLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Queuing Messages...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Megaphone size={18} /> Send Broadcast Now
                    </span>
                  )}
                </Button>
                {leads.filter(l => l.contact?.phone).length === 0 && (
                  <p className="text-[10px] text-center text-danger mt-2">No leads with phone numbers available to broadcast.</p>
                )}
              </div>
            </div>
          </div>

          {/* Step 1.5: Variable Mapping (shown only if template has variables) */}
          {selectedTemplate?.variables?.length > 0 && (
            <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <p className="text-sm font-semibold text-[var(--vz-heading)] flex items-center gap-2">
                <Variable size={14} className="text-primary" />
                Map Variables to Lead Fields
                <span className="text-[10px] font-normal text-[var(--vz-text-muted)]">(Each recipient will get their own value)</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTemplate.variables.map(v => (
                  <div key={v.index} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md flex-shrink-0 border border-primary/20">
                      &#123;&#123;{v.index}&#125;&#125;
                    </span>
                    <div className="flex-1">
                      <p className="text-[10px] text-[var(--vz-text-muted)] mb-0.5">{v.label || `Variable ${v.index}`}</p>
                      <Select
                        value={variableMapping[String(v.index)] || ''}
                        onChange={val => setVariableMapping(prev => ({ ...prev, [String(v.index)]: val }))}
                        options={[
                          { value: '', label: '-- Select field --' },
                          ...LEAD_FIELDS.map(f => ({ value: f.value, label: f.label })),
                          { value: '_custom', label: 'Custom text…' }
                        ]}
                      />
                      {variableMapping[String(v.index)] === '_custom' && (
                        <input
                          placeholder={v.example || 'Enter custom value'}
                          className="mt-1 w-full px-2 py-1 text-xs rounded-md border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-[var(--vz-text)] focus:outline-none focus:ring-1 focus:ring-primary/40"
                          onChange={e => setVariableMapping(prev => ({ ...prev, [`${v.index}_custom`]: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--vz-text-muted)] flex items-center gap-1">
                <Info size={10} /> If no field is mapped, the sample value ("{selectedTemplate.variables[0]?.example || 'default'}") will be used.
              </p>
            </div>
          )}
          </Card>
          )}
        </>
      )}
      {/* Template Modals */}
      <Modal isOpen={showCreateTemplate} onClose={() => setShowCreateTemplate(false)} title="Create Template" size="lg">
        <TemplateForm form={templateForm} onChange={setTemplateForm} />
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowCreateTemplate(false)}>Cancel</Button>
          <Button onClick={handleCreateTemplate} disabled={!templateForm.name || !templateForm.content?.body}>Submit for Approval</Button>
        </Modal.Footer>
      </Modal>

      <Modal isOpen={showEditTemplate} onClose={() => setShowEditTemplate(false)} title="Edit Template" size="lg">
        {editTemplateForm && (
          <>
            <TemplateForm form={editTemplateForm} onChange={setEditTemplateForm} />
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setShowEditTemplate(false)}>Cancel</Button>
              <Button onClick={handleUpdateTemplate}>Update Template</Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* Rule Modals */}
      <Modal isOpen={showCreateRule} onClose={() => setShowCreateRule(false)} title="Add Chatbot Rule" size="md">
        <div className="space-y-3">
          <Input label="Keyword" value={ruleForm.rule.triggerKeyword} onChange={(e) => setRuleForm({...ruleForm, rule: { ...ruleForm.rule, triggerKeyword: e.target.value }})} />
          <Input label="Auto-Reply Message" value={ruleForm.rule.responseContent} onChange={(e) => setRuleForm({...ruleForm, rule: { ...ruleForm.rule, responseContent: e.target.value }})} />
        </div>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowCreateRule(false)}>Cancel</Button>
          <Button onClick={handleCreateRule}>Add Rule</Button>
        </Modal.Footer>
      </Modal>

      <Modal isOpen={showEditRule} onClose={() => setShowEditRule(false)} title="Edit Chatbot Rule" size="md">
        {editRuleForm && (
          <div className="space-y-3" key={editRuleForm.id}>
            <Input label="Keyword" value={editRuleForm.rule?.triggerKeyword || ''} onChange={(e) => setEditRuleForm({...editRuleForm, rule: { ...editRuleForm.rule, triggerKeyword: e.target.value }})} />
            <Input label="Auto-Reply Message" value={editRuleForm.rule?.responseContent || ''} onChange={(e) => setEditRuleForm({...editRuleForm, rule: { ...editRuleForm.rule, responseContent: e.target.value }})} />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={editRuleForm.isActive ?? true} onChange={(e) => setEditRuleForm({...editRuleForm, isActive: e.target.checked})} id="rule-active" />
              <label htmlFor="rule-active" className="text-sm cursor-pointer">Active</label>
            </div>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setShowEditRule(false)}>Cancel</Button>
              <Button onClick={handleUpdateRule}>Update</Button>
            </Modal.Footer>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modals */}
      <ConfirmModal
        isOpen={!!deleteTemplateId}
        title="Delete Template?"
        message="Are you sure you want to delete this template?"
        confirmText="Delete"
        variant="danger"
        loading={isDeletingTemplate}
        onConfirm={handleDeleteTemplate}
        onCancel={() => setDeleteTemplateId(null)}
      />

      <ConfirmModal
        isOpen={!!deleteRuleId}
        title="Delete Rule?"
        message="Are you sure you want to delete this rule?"
        confirmText="Delete"
        variant="danger"
        loading={isDeletingRule}
        onConfirm={handleDeleteRule}
        onCancel={() => setDeleteRuleId(null)}
      />
    </>
  )
}
