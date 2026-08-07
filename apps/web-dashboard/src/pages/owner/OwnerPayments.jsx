import { useState } from 'react'
import { useGetPaymentConfigsQuery, useSavePaymentConfigMutation, useTestPaymentConfigMutation } from '../../features/owner/ownerApi'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { Edit, Server, CheckCircle2, CreditCard, Save, X, KeySquare } from 'lucide-react'

const PROVIDERS = [
  { id: 'razorpay', name: 'Razorpay', icon: CreditCard },
  { id: 'stripe', name: 'Stripe', icon: CreditCard }
]

export default function OwnerPayments() {
  const toast = useToast()
  const { data, isLoading, refetch } = useGetPaymentConfigsQuery()
  const [saveConfig, { isLoading: isSaving }] = useSavePaymentConfigMutation()
  const [testConfig, { isLoading: isTesting }] = useTestPaymentConfigMutation()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState(null)
  
  // Form State
  const [formData, setFormData] = useState({
    provider: 'razorpay',
    displayName: '',
    isActive: false,
    credentials: {},
    webhookSecret: ''
  })

  const configs = data?.data || []

  // Check if a provider is configured
  const getConfig = (providerId) => configs.find(c => c.provider === providerId)

  const handleOpenEdit = (providerId) => {
    const existing = getConfig(providerId)
    const providerConfig = PROVIDERS.find(p => p.id === providerId)
    
    setEditingProvider(providerId)
    setFormData({
      provider: providerId,
      displayName: existing?.displayName || providerConfig.name,
      isActive: existing?.isActive || false,
      credentials: existing?.credentials || {}, // The backend sends { keyId: true, keySecret: true } if they exist
      webhookSecret: existing?.webhookSecret ? '********' : ''
    })
    setIsModalOpen(true)
  }

  const handleClose = () => {
    setIsModalOpen(false)
    setEditingProvider(null)
  }

  const handleCredentialChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await saveConfig(formData).unwrap()
      toast.success(`${formData.displayName} configuration saved successfully`)
      handleClose()
      refetch()
    } catch (error) {
       toast.error(error.data?.message || 'Failed to save configuration')
    }
  }

  const handleTest = async (providerId) => {
    try {
      const response = await testConfig(providerId).unwrap()
      if (response.data.connected) {
        toast.success(`Connection to ${providerId} successful!`)
      }
    } catch (error) {
       toast.error(error.data?.message || `Failed to connect to ${providerId}`)
    }
  }

  // Dynamic input fields based on provider
  const renderCredentialInputs = () => {
    if (formData.provider === 'razorpay') {
      return (
        <>
          <Input 
            label="Key ID" 
            placeholder={formData.credentials?.keyId === true ? '•••••••••••• (Configured)' : 'rzp_test_...'}
            onChange={(e) => handleCredentialChange('keyId', e.target.value)}
            required={formData.credentials?.keyId !== true}
          />
          <Input 
            label="Key Secret" 
            type="password"
            placeholder={formData.credentials?.keySecret === true ? '•••••••••••• (Configured)' : 'Secret Key'}
            onChange={(e) => handleCredentialChange('keySecret', e.target.value)}
            required={formData.credentials?.keySecret !== true}
          />
        </>
      )
    }
    
    if (formData.provider === 'stripe') {
      return (
        <>
          <Input 
            label="Publishable Key" 
            placeholder={formData.credentials?.publishableKey === true ? '•••••••••••• (Configured)' : 'pk_test_...'}
            onChange={(e) => handleCredentialChange('publishableKey', e.target.value)}
            required={formData.credentials?.publishableKey !== true}
          />
          <Input 
            label="Secret Key" 
            type="password"
            placeholder={formData.credentials?.secretKey === true ? '•••••••••••• (Configured)' : 'sk_test_...'}
            onChange={(e) => handleCredentialChange('secretKey', e.target.value)}
            required={formData.credentials?.secretKey !== true}
          />
        </>
      )
    }

    return null
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-[var(--vz-text-muted)]">Loading payments...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xl font-black text-[var(--vz-heading)] tracking-tight">Payment Methods</h4>
          <p className="text-sm text-[var(--vz-text-muted)] mt-1">Configure external payment gateways like Razorpay and Stripe to accept tenant payments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {PROVIDERS.map((provider) => {
          const config = getConfig(provider.id)
          const isConfigured = !!config
          const isActive = config?.isActive

          return (
            <Card key={provider.id} className={`border-2 transition-all ${isActive ? 'border-success/30 shadow-success/5' : 'border-transparent'}`}>
              <Card.Header>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                      <Server size={20} />
                    </div>
                    <div>
                      <Card.Title>{provider.name}</Card.Title>
                      <span className="text-xs text-[var(--vz-text-muted)] mt-1 inline-block">Global Gateway</span>
                    </div>
                  </div>
                  {isConfigured ? (
                    <Badge color={isActive ? 'success' : 'warning'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  ) : (
                    <Badge color="light">Not Configured</Badge>
                  )}
                </div>
              </Card.Header>
              <div className="p-4 border-t border-[var(--vz-border)] bg-[var(--vz-bg-body)] flex justify-between items-center rounded-b-lg">
                {isConfigured && (
                  <Button variant="ghost" size="sm" onClick={() => handleTest(provider.id)} disabled={isTesting}>
                    <Server size={14} className="mr-2" /> Test Connection
                  </Button>
                )}
                {!isConfigured && <div />} {/* spacer */}
                <Button size="sm" onClick={() => handleOpenEdit(provider.id)}>
                   <Edit size={14} className="mr-2" /> {isConfigured ? 'Edit Config' : 'Configure'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Configuration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-lg shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <Card.Header className="flex justify-between items-center border-b border-[var(--vz-border)] shrink-0">
              <Card.Title className="flex items-center gap-2">
                <KeySquare size={18} className="text-primary"/>
                Configure {PROVIDERS.find(p => p.id === editingProvider)?.name}
              </Card.Title>
              <button onClick={handleClose} className="p-1 text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-[var(--vz-input-bg)] rounded transition-colors">
                <X size={20} />
              </button>
            </Card.Header>
            <div className="p-6 overflow-y-auto">
              <form id="paymentConfigForm" onSubmit={handleSubmit} className="space-y-4">
                <Input 
                  label="Display Name" 
                  value={formData.displayName} 
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})} 
                  required 
                />
                
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="text-xs text-warning/80 flex items-start gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    <span>Credentials are encrypted using AES-256-GCM before storage. Once saved, they will never be displayed in plaintext again. </span>
                  </p>
                </div>

                {renderCredentialInputs()}

                <Input 
                  label="Webhook Secret (Optional)" 
                  type="password"
                  placeholder={formData.webhookSecret === '********' ? '•••••••••••• (Configured)' : 'whsec_...'}
                  onChange={(e) => setFormData({...formData, webhookSecret: e.target.value})} 
                  helperText={formData.provider === 'stripe' ? 'Required to receive Stripe subscription webhooks.' : 'Used to verify Razorpay webhook signatures.'}
                />

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 rounded border-[var(--vz-border)] text-primary focus:ring-primary bg-[var(--vz-input-bg)]"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-[var(--vz-heading)] cursor-pointer">
                    Enable {PROVIDERS.find(p => p.id === editingProvider)?.name} as a Payment Gateway
                  </label>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-[var(--vz-border)] flex justify-end gap-3 shrink-0 bg-[var(--vz-bg-body)] rounded-b-lg">
              <Button variant="ghost" onClick={handleClose} type="button">Cancel</Button>
              <Button form="paymentConfigForm" type="submit" disabled={isSaving}>
                <Save size={16} className="mr-2" />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
