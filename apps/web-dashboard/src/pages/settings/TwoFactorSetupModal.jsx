import { useState, useEffect, useRef } from 'react'
import { Copy, CheckCircle, Loader2, ShieldCheck, Shield } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useGenerate2FAMutation, useVerify2FAMutation } from '../../features/auth/authApi'

export default function TwoFactorSetupModal({ isOpen, onClose }) {
  const toast = useToast()
  const [generate2FA, { isLoading: generating }] = useGenerate2FAMutation()
  const [verify2FA, { isLoading: verifying }] = useVerify2FAMutation()
  
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState([])
  
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef([])
  
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState(1) // 1 = Setup, 2 = Success

  const loadSetup = async () => {
    try {
      const res = await generate2FA().unwrap()
      setQrCodeUrl(res.data.qrCodeUrl)
      setSecret(res.data.secret)
      setBackupCodes(res.data.backupCodes || [])
    } catch (error) {
      toast('Failed to generate 2FA setup', 'error')
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadSetup()
    } else {
      setQrCodeUrl('')
      setSecret('')
      setBackupCodes([])
      setOtp(['', '', '', '', '', ''])
      setStep(1)
    }
  }, [isOpen])

  const handleCopy = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '')
    if (pastedData) {
      const newOtp = [...otp]
      for (let i = 0; i < pastedData.length; i++) {
        if (i < 6) newOtp[i] = pastedData[i]
      }
      setOtp(newOtp)
      const nextEmpty = newOtp.findIndex(val => val === '')
      if (nextEmpty !== -1) {
        inputRefs.current[nextEmpty]?.focus()
      } else {
        inputRefs.current[5]?.focus()
      }
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length !== 6) return toast('Please enter a 6-digit code', 'error')
    
    try {
      await verify2FA({ token: code }).unwrap()
      setStep(2)
      toast('Two-Factor Authentication Enabled', 'success')
      setTimeout(() => onClose(true), 2000) 
    } catch (error) {
      toast(error.data?.message || 'Invalid code, please try again', 'error')
    }
  }

  const modalTitle = (
    <div className="flex items-center gap-2">
      <div className="p-1 bg-[#5b50d6]/10 rounded-full text-[#5b50d6]">
        <ShieldCheck size={20} />
      </div>
      <span className="font-semibold text-lg text-slate-800">Set up Two-Factor Authentication</span>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={() => onClose(false)} title={step === 1 ? modalTitle : 'Setup Complete'} size="md">
      {step === 1 ? (
        <div className="space-y-8 mt-2 pb-4">
            
            {generating ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#5b50d6] mb-4" size={32} />
                <p className="text-sm text-slate-500">Generating secure keys...</p>
              </div>
            ) : (
              <>
                {/* Step 1: QR Code */}
                <div className="text-center">
                  <h3 className="font-semibold text-slate-800 mb-1 text-[15px]">1. Scan this QR code with your authenticator app</h3>
                  <p className="text-xs text-slate-500 mb-6">Use apps like Google Authenticator, Microsoft Authenticator, or Authy.</p>
                  
                  <div className="flex justify-center mb-2">
                    <div className="relative p-6 bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 flex items-center justify-center"
                         style={{
                             backgroundImage: 'radial-gradient(#e2e8f0 2px, transparent 2px)',
                             backgroundSize: '16px 16px',
                             backgroundPosition: '-8px -8px'
                         }}>
                      <div className="bg-white p-2 rounded-xl relative z-10 shadow-sm border border-slate-100">
                        {qrCodeUrl ? (
                          <div className="relative">
                            <img src={qrCodeUrl} alt="2FA QR Code" className="w-[180px] h-[180px]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-white p-1 rounded-md shadow-sm border border-slate-100 flex items-center justify-center w-10 h-10">
                                <Shield className="text-[#5b50d6]" size={20} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-[180px] h-[180px] bg-slate-50 animate-pulse rounded-xl" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Manual Code */}
                <div className="text-center">
                  <h3 className="font-semibold text-slate-800 mb-3 text-[15px]">2. Or enter this code manually</h3>
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-2">
                        <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono tracking-widest text-slate-700 min-w-[280px]">
                        {secret || 'Loading...'}
                        </div>
                        <button 
                        onClick={handleCopy}
                        className="p-2.5 rounded-lg border border-slate-200 text-[#5b50d6] hover:bg-slate-50 transition-colors bg-white shadow-sm"
                        title="Copy code"
                        >
                        {copied ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
                        </button>
                    </div>
                  </div>
                </div>
                
                <hr className="border-slate-100" />

                {/* Step 3: Enter OTP */}
                <div className="text-center">
                  <h3 className="font-semibold text-slate-800 mb-4 text-[15px]">3. Enter the 6-digit code from your authenticator app</h3>
                  
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        className={`w-12 h-14 text-center text-xl font-medium rounded-xl border focus:outline-none transition-all
                          ${digit ? 'border-[#5b50d6] ring-1 ring-[#5b50d6] text-[#5b50d6]' : 'border-slate-200 text-slate-800 focus:border-[#5b50d6] focus:ring-1 focus:ring-[#5b50d6]'}`}
                        placeholder="0"
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <ShieldCheck size={14} className="text-[#5b50d6]" />
                    <span>Enter the 6-digit code to verify and enable two-factor authentication.</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-5">
              <CheckCircle size={32} />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">2FA Enabled Successfully!</h4>
            <p className="text-sm text-slate-500 mb-8 max-w-sm">
              Your account is now protected. Please save these recovery codes in a safe place. You will need them if you lose access to your authenticator app.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 w-full text-left">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-semibold text-amber-800">Recovery Codes</p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join('\n'))
                    toast('Recovery codes copied!', 'success')
                  }}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 transition-colors px-3 py-1.5 rounded-lg"
                >
                  <Copy size={14} /> Copy All
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {backupCodes.map((bc, i) => (
                  <code key={i} className="text-sm font-mono bg-white px-3 py-2 rounded-lg border border-amber-100 text-center text-slate-700 tracking-wider shadow-sm">
                    {bc}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}
      <Modal.Footer className="bg-slate-50 py-4 px-6 border-t-0 rounded-b-lg">
        {step === 1 ? (
          <div className="flex justify-end gap-3 w-full items-center">
            <button onClick={() => onClose(false)} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors px-4 py-2">
                Cancel
            </button>
            <Button onClick={handleVerify} disabled={otp.join('').length !== 6 || verifying || generating} className="bg-[#5b50d6] hover:bg-[#4a40bd] text-white rounded-lg flex items-center gap-2 px-6 py-2.5">
              <Shield size={16} />
              {verifying ? 'Verifying...' : 'Verify & Enable'}
            </Button>
          </div>
        ) : (
          <Button onClick={() => onClose(true)} className="w-full bg-[#5b50d6] hover:bg-[#4a40bd] text-white rounded-lg py-3">I have saved these codes, Done</Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
