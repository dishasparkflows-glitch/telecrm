import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { closeDialer } from '../../slices/uiSlice'
import { useInitiateCallMutation } from '../../features/calls/callApi'
import { Phone, X, Delete, PhoneOff, User } from 'lucide-react'
import { useSocketEvent } from '../../hooks/useSocketEvent'
import { useToast } from '../ui/Toast'

export default function Dialer() {
  const dispatch = useDispatch()
  const toast = useToast()
  const { dialerOpen, dialerNumber, dialerLeadId } = useSelector((s) => s.ui)
  const [number, setNumber] = useState('')
  const [status, setStatus] = useState('idle') // idle, calling, active, ended
  const [duration, setDuration] = useState(0)
  const [initiateCall, { isLoading }] = useInitiateCallMutation()
  const location = useLocation()

  // Listen for call_completed via the SocketContext (correct architecture)
  // useNotificationsSocket returns null — use useSocketEvent directly instead
  useSocketEvent('call_completed', () => {
    // Auto-close dialer when call ends from either side (customer or agent)
    setStatus('ended')
    setTimeout(() => {
      setStatus('idle')
      setDuration(0)
      dispatch(closeDialer())
    }, 2000)
  })

  useEffect(() => {
    if (!location.pathname.startsWith('/leads')) {
      dispatch(closeDialer())
    }
  }, [location.pathname, dispatch])

  useEffect(() => {
    if (dialerNumber) setNumber(dialerNumber)
  }, [dialerNumber])

  useEffect(() => {
    let timer
    if (status === 'active') {
      timer = setInterval(() => setDuration(d => d + 1), 1000)
    }
    return () => clearInterval(timer)
  }, [status])

  if (!dialerOpen) return null

  const handleKeyPress = (val) => {
    if (status === 'idle') setNumber(prev => prev + val)
  }

  const handleCall = async () => {
    if (!number) return
    setStatus('calling')
    try {
      await initiateCall({ phone: number, leadId: dialerLeadId }).unwrap()
      setTimeout(() => setStatus('active'), 2000) // Simulate connection
    } catch {
      toast('Call failed', 'error')
      setStatus('idle')
    }
  }

  const handleEnd = () => {
    setStatus('ended')
    setTimeout(() => {
      setStatus('idle')
      setDuration(0)
      if (!dialerNumber) setNumber('')
      dispatch(closeDialer())
    }, 2000)
  }

  const formatDuration = (s) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="p-4 bg-primary flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Phone size={18} fill="currentColor" />
          <span className="font-semibold text-sm">Dialer</span>
        </div>
        <button onClick={() => dispatch(closeDialer())} className="hover:bg-white/20 p-1 rounded-full transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Screen */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="text-center mb-6">
          {status === 'idle' ? (
            <input 
              type="text" 
              value={number} 
              readOnly 
              placeholder="Enter number..."
              className="text-2xl font-bold bg-transparent border-none outline-none text-center text-[var(--vz-heading)] w-full placeholder:text-[var(--vz-text-muted)]"
            />
          ) : (
            <>
              <div className="w-16 h-16 mx-auto bg-[var(--vz-input-bg)] rounded-full flex items-center justify-center mb-3">
                <User size={32} className="text-primary" />
              </div>
              <p className="text-xl font-bold text-[var(--vz-heading)]">{number}</p>
              <p className={`text-sm font-medium mt-1 ${status === 'calling' ? 'text-warning animate-pulse' : status === 'active' ? 'text-success' : 'text-danger'}`}>
                {status === 'calling' ? 'Calling...' : status === 'active' ? formatDuration(duration) : 'Call Ended'}
              </p>
            </>
          )}
        </div>

        {/* Keypad */}
        {status === 'idle' && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(k => (
              <button 
                key={k} 
                onClick={() => handleKeyPress(k.toString())}
                className="h-12 rounded-lg bg-[var(--vz-input-bg)] hover:bg-primary/10 hover:text-primary text-lg font-semibold text-[var(--vz-heading)] transition-all active:scale-95"
              >
                {k}
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center items-center gap-6">
          {status === 'idle' ? (
            <>
              <button onClick={() => setNumber(prev => prev.slice(0, -1))} className="p-3 text-danger hover:text-danger-dark">
                <Delete size={20} />
              </button>
              <button 
                onClick={handleCall}
                disabled={!number || isLoading}
                className="w-14 h-14 bg-success text-white rounded-full flex items-center justify-center shadow-lg shadow-success/30 hover:bg-success/90 transition-all active:scale-95 disabled:opacity-50"
              >
                <Phone size={24} fill="currentColor" />
              </button>
              <div className="w-10" />
            </>
          ) : status === 'active' ? (
            <>
              <div className="w-10" />
              <button 
                onClick={handleEnd}
                className="w-14 h-14 bg-danger text-white rounded-full flex items-center justify-center shadow-lg shadow-danger/30 hover:bg-danger/90 transition-all active:scale-95"
              >
                <PhoneOff size={24} fill="currentColor" />
              </button>
              <div className="w-10" />
            </>
          ) : (
            <div className="h-14" />
          )}
        </div>
      </div>
    </div>
  )
}
