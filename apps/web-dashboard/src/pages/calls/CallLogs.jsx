import { useState, useRef, useEffect } from 'react'
import { useGetCallLogsQuery, useGetCallStatsQuery, useUpdateDispositionMutation } from '../../features/calls/callApi'
import { useGetProfileQuery } from '../../features/tenant/tenantApi'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Phone, Clock, PhoneIncoming, PhoneMissed, Search, ChevronLeft, ChevronRight, ChevronDown, Play, Pause, Download, MoreVertical, ArrowUpRight, ArrowDownLeft, Filter, Calendar as CalendarIcon, RefreshCw, X, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function MiniAudioPlayer({ src, durationText, downloadUrl, downloadName = 'recording.mp3' }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}) }
  }

  const handleDownload = async () => {
    if (downloadUrl) {
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }
    
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(src, '_blank')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
         <button onClick={toggle} className="text-primary hover:text-primary/80 transition-colors">
           {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
         </button>
         <span className="text-xs font-semibold text-primary">{durationText}</span>
      </div>
      <button onClick={handleDownload} className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 transition-colors">
        <Download size={14} />
      </button>
    </div>
  )
}

function InlineDisposition({ log, configuredDispositions, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const options = configuredDispositions.filter(d => d.isActive).map(d => ({
    value: d.slug,
    label: d.name,
    color: d.color?.startsWith('#') ? d.color : (
        d.color === 'success' ? '#22c55e' :
        d.color === 'danger' ? '#ef4444' :
        d.color === 'warning' ? '#f59e0b' : '#3b82f6'
    )
  }))

  const selectedOpt = options.find(o => o.value === log.disposition?.code)

  return (
    <div className="relative inline-block w-44" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-md border border-slate-200 text-[13px] px-2.5 py-1.5 outline-none bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm group focus:ring-2 focus:ring-primary/20"
      >
        <div className="flex items-center gap-2 overflow-hidden">
           {selectedOpt?.color ? (
              <>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedOpt.color }} />
                <span className="font-medium truncate">{selectedOpt.label}</span>
              </>
           ) : (
              <span className="text-slate-400 font-medium truncate">Set disposition</span>
           )}
        </div>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[99] mt-1 w-full min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-lg py-1 left-0">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-slate-400">No options configured</div>
          ) : options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                 setIsOpen(false)
                 if (log.disposition?.code !== opt.value) {
                     onUpdate(log._id, opt.value)
                 }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-slate-50 transition-colors ${log.disposition?.code === opt.value ? 'bg-blue-50/50 font-medium text-primary' : 'text-slate-700'}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function getAvatarInitials(name, fallback = 'U') {
  if (!name) return fallback
  const parts = name.trim().split(' ')
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function CallLogs() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)

  const { data: logsData, isLoading } = useGetCallLogsQuery({ page, limit: pageSize })
  const { data: statsData } = useGetCallStatsQuery()
  const { data: profileData } = useGetProfileQuery()
  const [updateDisposition] = useUpdateDispositionMutation()

  const configuredDispositions = profileData?.data?.callDispositions || []

  const logs = logsData?.data || []
  const pagination = logsData?.pagination || {}
  const stats = statsData?.data || {}

  const handleDispositionUpdate = async (id, code) => {
    try {
      await updateDisposition({ id, disposition: code }).unwrap()
      toast('Disposition updated', 'success')
    } catch { toast('Failed to update disposition', 'error') }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
          <div>
              <h1 className="text-2xl font-bold text-slate-900">Call Logs</h1>
              <p className="text-sm text-slate-500 mt-1">Track and manage all customer calls</p>
          </div>
          <div className="text-sm text-slate-400 font-medium hidden sm:block">
              CRM &gt; <span className="text-slate-700">Calls</span>
          </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                    <Phone size={24} />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-0.5">Total Calls</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalCalls || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">All time</p>
                </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center">
                    <PhoneIncoming size={24} />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-0.5">Connected</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.connected || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">{stats.totalCalls ? ((stats.connected/stats.totalCalls)*100).toFixed(1) : 0}% of total</p>
                </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                    <PhoneMissed size={24} />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-0.5">Missed</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.missed || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">{stats.totalCalls ? ((stats.missed/stats.totalCalls)*100).toFixed(1) : 0}% of total</p>
                </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
                    <Clock size={24} />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-0.5">Avg Duration</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.avgDuration ? formatDuration(stats.avgDuration) : '0:00'}</p>
                    <p className="text-xs text-slate-400 mt-1">Average talk time</p>
                </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
        </div>
      </div>

      {/* Table */}
      <Card noPadding className="mb-6 shadow-sm border-slate-200">
        <div className="p-4 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="relative w-full lg:w-96">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Search by lead name or phone..." value={search} onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50
                        text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                        <Filter size={16} className="text-slate-400" /> Filters
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors min-w-[220px] justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={16} className="text-slate-400" />
                            <span>20 Aug 2026 - 26 Aug 2026</span>
                        </div>
                        <ChevronDown size={14} className="text-slate-400" />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                        <RefreshCw size={14} className="text-slate-400" /> Reset
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors">
                        <Download size={16} /> Export
                    </button>
                </div>
            </div>
            
            {/* Filter Pills */}
            <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-md text-xs font-medium text-slate-700">
                    Agent: All <button className="ml-1 text-slate-400 hover:text-slate-600"><X size={12} /></button>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-md text-xs font-medium text-slate-700">
                    Status: All <button className="ml-1 text-slate-400 hover:text-slate-600"><X size={12} /></button>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-md text-xs font-medium text-slate-700">
                    Disposition: All <button className="ml-1 text-slate-400 hover:text-slate-600"><X size={12} /></button>
                </div>
                <button className="text-xs font-medium text-primary hover:underline ml-2">Clear all</button>
            </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={Phone} title="No call logs" description="Call logs will appear here once calls are initiated" />
        ) : (
          <>
            <div className="overflow-visible">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    {['LEAD', 'PHONE', 'DIRECTION', 'AGENT', 'DURATION', 'STATUS', 'DISPOSITION', 'RECORDING', 'DATE & TIME', 'ACTIONS'].map((h) => (
                      <th key={h} className="px-6 py-4 text-left text-[11px] font-bold uppercase text-slate-400 tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const leadName = `${log.leadId?.contact?.firstName || ''} ${log.leadId?.contact?.lastName || ''}`.trim() || 'Unknown Lead';
                    const agentName = log.userId?.contact?.name || 'Unknown Agent';
                    const direction = log.call?.direction === 'inbound' ? 'Incoming' : 'Outgoing';
                    const isIncoming = direction === 'Incoming';
                    const status = log.call?.status || 'initiated';
                    
                    let mappedStatus = 'Calling';
                    let statusColor = 'primary'; // blue
                    if (status === 'completed') { mappedStatus = 'Answered'; statusColor = 'success'; }
                    else if (status === 'missed' || status === 'no-answer' || status === 'busy') { mappedStatus = 'Missed'; statusColor = 'danger'; }
                    else if (status === 'failed') { mappedStatus = 'Failed'; statusColor = 'danger'; }

                    const durText = formatDuration(log.call?.duration);
                    
                    return (
                      <tr key={log._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                    {getAvatarInitials(leadName)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-900">{leadName}</span>
                                    {log.leadId && (
                                        <Link to={`/leads/${log.leadId._id}`} className="text-[11px] text-primary hover:underline font-medium">View lead</Link>
                                    )}
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                <Phone size={14} className="text-slate-400" />
                                {log.leadId?.contact?.phone || log.numbers?.to || log.call?.to || '—'}
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-slate-700 font-medium text-[13px]">
                                {isIncoming ? (
                                    <ArrowDownLeft size={16} className="text-red-500" />
                                ) : (
                                    <ArrowUpRight size={16} className="text-green-500" />
                                )}
                                {direction}
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                {log.userId?.contact?.avatar ? (
                                    <img src={log.userId.contact.avatar} alt="Agent" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                                        {getAvatarInitials(agentName)}
                                    </div>
                                )}
                                <span className="font-medium text-slate-700">{agentName}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">{durText}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                              statusColor === 'success' ? 'bg-green-100 text-green-700' :
                              statusColor === 'danger' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                          }`}>
                              {mappedStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <InlineDisposition 
                            log={log} 
                            configuredDispositions={configuredDispositions} 
                            onUpdate={handleDispositionUpdate} 
                          />
                        </td>
                        <td className="px-6 py-4">
                          {log.recording?.playbackUrl ? (
                            <MiniAudioPlayer 
                              src={log.recording.playbackUrl} 
                              durationText={durText}
                              downloadUrl={log.recording.downloadUrl}
                              downloadName={`${leadName}_${new Date(log.audit?.createdAt || new Date()).toLocaleDateString().replace(/\//g, '-')}.mp3`.replace(/\s+/g, '_')}
                            />
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">No recording</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col text-[13px]">
                                <span className="font-medium text-slate-700">{new Date(log.audit?.createdAt || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                <span className="text-slate-500">{new Date(log.audit?.createdAt || new Date()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100 inline-flex items-center justify-center">
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(pagination.total || 0) > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 bg-white">
                <p className="text-sm font-medium text-slate-500 w-full sm:w-1/3 text-left">
                  Showing {Math.min((page - 1) * pageSize + 1, pagination.total)} to{' '}
                  {Math.min(page * pageSize, pagination.total)} of {pagination.total} calls
                </p>

                <div className="w-full sm:w-1/3 flex justify-center">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:text-slate-400 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: pagination.totalPages || 1 }, (_, i) => i + 1).map((p) => {
                        // Show ellipsis for too many pages
                        if (pagination.totalPages > 7 && p > 3 && p < pagination.totalPages - 2 && p !== page) {
                            if (p === 4) return <span key={p} className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>
                            return null;
                        }
                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${page === p
                              ? 'bg-blue-50 text-primary border border-blue-100'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-transparent'
                              }`}
                          >
                            {p}
                          </button>
                        )
                    })}
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === (pagination.totalPages || 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:text-slate-400 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="w-full sm:w-1/3 flex justify-end items-center gap-3">
                  <div className="relative inline-flex items-center">
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                      className="text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:border-primary shadow-sm appearance-none cursor-pointer"
                    >
                      {[10, 15, 20, 50].map((size) => (
                        <option key={size} value={size}>{size} per page</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

    </>
  )
}
