import { useState, useEffect } from 'react'
import { MessageSquare, Phone, Settings, CheckCircle, XCircle, Loader2, Save, Wifi } from 'lucide-react'
import Card from '../../components/ui/Card'

import { useToast } from '../../components/ui/Toast'
import {
  useGetCommunicationConfigsQuery,
  useUpdateCommunicationConfigMutation,
  useTestCommunicationConfigMutation,
} from '../../features/owner/ownerApi'

const TABS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { key: 'calling', label: 'Calling', icon: Phone },
]

const WHATSAPP_FIELDS = [
  { key: 'appId', label: 'Meta App ID', placeholder: 'e.g. 123456789012345', sensitive: false },
  { key: 'appSecret', label: 'App Secret', placeholder: 'Enter Meta App Secret', sensitive: true },
  { key: 'accessToken', label: 'System User Access Token', placeholder: 'Long-lived access token', sensitive: true },
  { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: 'e.g. 109876543210123', sensitive: false },
  { key: 'businessAccountId', label: 'Business Account ID (WABA)', placeholder: 'e.g. 102345678901234', sensitive: false },
  { key: 'webhookVerifyToken', label: 'Webhook Verify Token', placeholder: 'Your custom verify token', sensitive: true },
]

const EXOTEL_FIELDS = [
  { key: 'apiKey', label: 'API Key', placeholder: 'Exotel API Key', sensitive: true },
  { key: 'apiToken', label: 'API Token', placeholder: 'Exotel API Token', sensitive: true },
  { key: 'sid', label: 'Account SID', placeholder: 'e.g. sparkcrm1', sensitive: false },
  { key: 'subdomain', label: 'Subdomain', placeholder: 'e.g. api.exotel.com', sensitive: false },
  { key: 'callerId', label: 'Caller ID (Virtual Number)', placeholder: 'e.g. 08047193300', sensitive: false },
]

const TWILIO_FIELDS = [
  { key: 'accountSid', label: 'Account SID', placeholder: 'Twilio Account SID', sensitive: false },
  { key: 'authToken', label: 'Auth Token', placeholder: 'Twilio Auth Token', sensitive: true },
  { key: 'phoneNumber', label: 'Twilio Phone Number', placeholder: 'e.g. +14155552671', sensitive: false },
]

export default function OwnerSettings() {
  const [activeTab, setActiveTab] = useState('whatsapp')
  const [whatsappForm, setWhatsappForm] = useState({ provider: 'meta', isActive: false, displayName: 'WhatsApp (Meta)', credentials: {} })
  const [callingForm, setCallingForm] = useState({ provider: 'exotel', isActive: false, displayName: 'Calling', credentials: {} })
  const toast = useToast()

  const { data: configsRes, isLoading } = useGetCommunicationConfigsQuery()
  const [updateConfig, { isLoading: isSaving }] = useUpdateCommunicationConfigMutation()
  const [testConfig, { isLoading: isTesting }] = useTestCommunicationConfigMutation()

  // Populate forms from fetched data
  useEffect(() => {
    if (!configsRes?.data) return
    const configs = configsRes.data

    const waConfig = configs.find(c => c.type === 'whatsapp')
    if (waConfig) {
      setWhatsappForm({
        provider: waConfig.provider || 'meta',
        isActive: waConfig.isActive || false,
        displayName: waConfig.displayName || 'WhatsApp (Meta)',
        credentials: waConfig.credentials || {},
        testStatus: waConfig.testStatus,
        testMessage: waConfig.testMessage,
        lastTestedAt: waConfig.lastTestedAt,
      })
    }

    const callConfig = configs.find(c => c.type === 'calling')
    if (callConfig) {
      setCallingForm({
        provider: callConfig.provider || 'exotel',
        isActive: callConfig.isActive || false,
        displayName: callConfig.displayName || 'Calling',
        credentials: callConfig.credentials || {},
        testStatus: callConfig.testStatus,
        testMessage: callConfig.testMessage,
        lastTestedAt: callConfig.lastTestedAt,
      })
    }
  }, [configsRes])

  const currentForm = activeTab === 'whatsapp' ? whatsappForm : callingForm
  const setCurrentForm = activeTab === 'whatsapp' ? setWhatsappForm : setCallingForm

  const currentFields = activeTab === 'whatsapp'
    ? WHATSAPP_FIELDS
    : currentForm.provider === 'twilio'
      ? TWILIO_FIELDS
      : EXOTEL_FIELDS

  const handleCredentialChange = (key, value) => {
    setCurrentForm(prev => {
      if (activeTab === 'calling') {
        const provider = prev.provider;
        return {
          ...prev,
          credentials: {
            ...prev.credentials,
            [provider]: {
              ...(prev.credentials[provider] || {}),
              [key]: value
            }
          }
        }
      }
      return {
        ...prev,
        credentials: { ...prev.credentials, [key]: value },
      }
    })
  }

  const handleSave = async () => {
    try {
      await updateConfig({
        type: activeTab,
        provider: currentForm.provider,
        isActive: currentForm.isActive,
        displayName: currentForm.displayName,
        credentials: currentForm.credentials,
      }).unwrap()
      toast('Configuration saved successfully!', 'success')
    } catch (err) {
      toast(err?.data?.message || 'Failed to save configuration', 'error')
    }
  }

  const handleTest = async () => {
    try {
      const res = await testConfig(activeTab).unwrap()
      const result = res.data || res
      if (result.testStatus === 'success') {
        toast(result.testMessage || 'Connection successful!', 'success')
        setCurrentForm(prev => ({ ...prev, testStatus: 'success', testMessage: result.testMessage, lastTestedAt: result.lastTestedAt }))
      } else {
        toast(result.testMessage || 'Connection failed', 'error')
        setCurrentForm(prev => ({ ...prev, testStatus: 'failed', testMessage: result.testMessage, lastTestedAt: result.lastTestedAt }))
      }
    } catch (err) {
      toast(err?.data?.message || 'Test failed', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-black text-[var(--vz-heading)]">System Settings</h4>
        <p className="text-sm text-[var(--vz-text-muted)] mt-1">Configure global WhatsApp and Calling integrations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--vz-card-bg)] rounded-xl p-1 border border-[var(--vz-border)]" style={{ width: 'fit-content' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-[var(--vz-light)]'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <Card>
        <div className="p-6 space-y-6">
          {/* Header with toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--vz-border)]">
            <div className="flex items-center gap-3">
              {activeTab === 'whatsapp' ? <MessageSquare size={24} className="text-green-500" /> : <Phone size={24} className="text-blue-500" />}
              <div>
                <h5 className="text-base font-bold text-[var(--vz-heading)]">
                  {activeTab === 'whatsapp' ? 'WhatsApp — Meta Cloud API' : 'Calling — Telephony Provider'}
                </h5>
                <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">
                  {activeTab === 'whatsapp'
                    ? 'Connect your Meta WhatsApp Business Account to enable messaging for all tenants'
                    : 'Configure Exotel or Twilio for click-to-call functionality across all tenants'}
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-medium text-[var(--vz-text-muted)]">
                {currentForm.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={currentForm.isActive}
                  onChange={e => setCurrentForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-300 peer-checked:bg-green-500 rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
            </label>
          </div>

          {/* Test status indicator */}
          {currentForm.testStatus && currentForm.testStatus !== 'untested' && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
              currentForm.testStatus === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {currentForm.testStatus === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span className="font-medium">{currentForm.testMessage}</span>
              {currentForm.lastTestedAt && (
                <span className="ml-auto text-xs opacity-70">
                  Tested: {new Date(currentForm.lastTestedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Provider select (Calling tab only) */}
          {activeTab === 'calling' && (
            <div>
              <label className="block text-sm font-semibold text-[var(--vz-heading)] mb-1.5">Provider</label>
              <div className="flex gap-3">
                {['exotel', 'twilio'].map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentForm(prev => ({ ...prev, provider: p, credentials: {} }))}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                      currentForm.provider === p
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-[var(--vz-border)] text-[var(--vz-text-muted)] hover:border-primary/30'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Credential fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentFields.map(field => (
              <div key={field.key} className={field.key === 'accessToken' ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-semibold text-[var(--vz-heading)] mb-1.5">
                  {field.label}
                  {field.sensitive && <span className="text-xs text-[var(--vz-text-muted)] ml-1">(encrypted)</span>}
                </label>
                <input
                  type={field.sensitive ? 'password' : 'text'}
                  value={
                    activeTab === 'calling' 
                      ? (currentForm.credentials[currentForm.provider]?.[field.key] || '')
                      : (currentForm.credentials[field.key] || '')
                  }
                  onChange={e => handleCredentialChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-input-bg)] text-[var(--vz-body-color)] text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--vz-border)]">
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold border border-[var(--vz-border)] text-[var(--vz-heading)] hover:bg-[var(--vz-light)] transition-all disabled:opacity-50"
            >
              {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-primary text-white hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Configuration
            </button>
          </div>
        </div>
      </Card>

      {/* Info card */}
      <Card>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <Settings size={18} className="text-[var(--vz-text-muted)] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[var(--vz-text-muted)] space-y-1.5">
              <p className="font-semibold text-[var(--vz-heading)]">How it works</p>
              {activeTab === 'whatsapp' ? (
                <>
                  <p>Configure your Meta WhatsApp Business API credentials here. Once active, all tenant users can send and receive WhatsApp messages using their assigned phone numbers.</p>
                  <p>You'll need a <strong>Meta Business App</strong>, a <strong>WhatsApp Business Account (WABA)</strong>, and a <strong>System User Access Token</strong> with <code>whatsapp_business_messaging</code> permission.</p>
                </>
              ) : (
                <>
                  <p>Configure your telephony provider (Exotel or Twilio) credentials here. Once active, all tenant users can make and receive calls using their assigned phone numbers as caller IDs.</p>
                  <p>Each user's phone number (set during registration) is automatically used for outbound calls through the provider's API.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
