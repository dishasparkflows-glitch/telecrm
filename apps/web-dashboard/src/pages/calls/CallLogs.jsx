import { useState, useRef, useCallback, useEffect } from 'react'
import { useGetCallLogsQuery, useGetCallStatsQuery, useUpdateDispositionMutation } from '../../features/calls/callApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import KPICard from '../../components/ui/KPICard'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Phone, Clock, PhoneIncoming, PhoneMissed, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Play, Pause, Volume2, VolumeX, MoreVertical, Download } from 'lucide-react'

const statusColors = { completed: 'success', missed: 'danger', busy: 'warning', 'no-answer': 'info', failed: 'danger' }

/* ── Compact audio player ─────────────────────────────────── */

const SPEEDS = [0.5, 1, 1.5, 2]

function MiniAudioPlayer({ src }) {
  const audioRef = useRef(null)
  const menuRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [speedSubmenu, setSpeedSubmenu] = useState(false)

  const fmt = (s) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const toggle = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) }
    else { el.play().then(() => setPlaying(true)).catch(() => {}) }
  }, [playing])

  const changeSpeed = (s) => {
    setSpeed(s)
    if (audioRef.current) audioRef.current.playbackRate = s
    setMenuOpen(false)
  }

  const handleDownload = async () => {
    setMenuOpen(false)
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'recording.mp3'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(src, '_blank')
    }
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) { setMenuOpen(false); setSpeedSubmenu(false) } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
      >
        {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
      </button>
      <span className="text-xs font-medium text-[var(--vz-text-muted)] tabular-nums w-[72px]">
        {fmt(currentTime)} / {fmt(duration)}
      </span>
      <button
        type="button"
        onClick={() => { if (audioRef.current) { audioRef.current.muted = !muted; setMuted(!muted) } }}
        className="text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors"
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      {/* Three-dot menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-[var(--vz-input-bg)] transition-colors"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl shadow-xl z-50 py-2 text-sm overflow-hidden">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[var(--vz-input-bg)] flex items-center gap-3 text-[var(--vz-heading)] transition-colors"
            >
              <Download size={18} className="text-gray-500" />
              Download
            </button>
            <div className="border-t border-[var(--vz-border)] my-1" />
            <button
              type="button"
              onClick={() => setSpeedSubmenu(!speedSubmenu)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[var(--vz-input-bg)] flex items-center gap-3 text-[var(--vz-heading)] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Playback speed
              {speed !== 1 && <span className="ml-auto text-xs text-primary font-semibold">{speed}x</span>}
            </button>
            {speedSubmenu && (
              <div className="border-t border-[var(--vz-border)] bg-gray-50/50 dark:bg-[var(--vz-body-bg)]/30">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeSpeed(s)}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[var(--vz-input-bg)] flex items-center justify-between transition-colors ${
                      speed === s ? 'text-primary font-semibold' : 'text-[var(--vz-heading)]'
                    }`}
                  >
                    <span className="pl-8">{s}x</span>
                    {speed === s && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CallLogs() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showDisp, setShowDisp] = useState(null)
  const [disposition, setDisposition] = useState('')
  const [pageSize, setPageSize] = useState(15)

  const { data: logsData, isLoading } = useGetCallLogsQuery({ page, limit: pageSize })
  const { data: statsData } = useGetCallStatsQuery()
  const [updateDisposition] = useUpdateDispositionMutation()

  const logs = logsData?.data || []
  const pagination = logsData?.pagination || {}
  const stats = statsData?.data || {}

  const handleDisposition = async () => {
    try {
      await updateDisposition({ id: showDisp, disposition }).unwrap()
      toast('Disposition updated', 'success')
      setShowDisp(null)
      setDisposition('')
    } catch { toast('Failed to update', 'error') }
  }

  return (
    <>
      <PageHeader title="Call Logs" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Calls' }]} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Calls" value={stats.totalCalls || 0} icon={Phone} iconColor="primary" />
        <KPICard title="Connected" value={stats.connected || 0} icon={PhoneIncoming} iconColor="success" />
        <KPICard title="Missed" value={stats.missed || 0} icon={PhoneMissed} iconColor="danger" />
        <KPICard title="Avg Duration" value={stats.avgDuration || '0s'} icon={Clock} iconColor="info" />
      </div>

      {/* Table */}
      <Card noPadding>
        <div className="p-4 border-b border-[var(--vz-border)]">
          <div className="relative w-full sm:w-[280px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
            <input type="text" placeholder="Search calls..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)]
                text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] outline-none focus:border-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[var(--vz-text-muted)]">Loading...</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={Phone} title="No call logs" description="Call logs will appear here once calls are initiated" />
        ) : (
          <>
            <div className="overflow-visible">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[var(--vz-table-header-bg)]">
                    {['Lead', 'Phone', 'Agent', 'Duration', 'Status', 'Disposition', 'Recording', 'Date', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">
                        {`${log.leadId.contact.firstName} ${log.leadId.contact.lastName || ''}`.trim()}
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{log.leadId?.contact?.phone || log.numbers?.to || log.phone || '—'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{log.userId?.contact?.name || '—'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{log.call?.duration != null ? `${log.call.duration}s` : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge color={statusColors[log.call?.status || 'initiated'] || 'primary'}>{log.call?.status || 'initiated'}</Badge>
                        {log.call?.status === 'failed' && log.provider?.data?.error?.code === 'EXOTEL_KYC_REQUIRED' && (
                          <div className="text-[10px] text-danger mt-1 font-medium">Exotel KYC verification required</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)] capitalize">{log.disposition?.code || '—'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">
                        {log.recording?.playbackUrl ? (
                          <MiniAudioPlayer src={log.recording.playbackUrl} />
                        ) : log.recording?.status === 'processing' ? (
                          <span className="text-xs text-[var(--vz-text-muted)] italic">⏳ Recording processing...</span>
                        ) : (
                          <span className="text-xs text-[var(--vz-text-muted)] italic">No recording available</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)] text-xs">{new Date(log.audit?.createdAt || new Date()).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => { setShowDisp(log._id); setDisposition(log.disposition?.code || '') }}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(pagination.total || 0) > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-[var(--vz-border)] bg-white dark:bg-[var(--vz-card-bg)]">
                <p className="text-sm font-medium text-[var(--vz-text-muted)] w-full sm:w-1/3 text-left">
                  Showing {Math.min((page - 1) * pageSize + 1, pagination.total)} to{' '}
                  {Math.min(page * pageSize, pagination.total)} of {pagination.total} Results
                </p>

                <div className="w-full sm:w-1/3 flex justify-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded border border-[var(--vz-border)] text-[#3b548b] hover:border-[#3b548b] disabled:opacity-40 disabled:hover:border-[var(--vz-border)] disabled:text-[var(--vz-text-muted)] transition-colors shadow-sm bg-white dark:bg-transparent"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded border border-[var(--vz-border)] text-[#3b548b] hover:border-[#3b548b] disabled:opacity-40 disabled:hover:border-[var(--vz-border)] disabled:text-[var(--vz-text-muted)] transition-colors shadow-sm bg-white dark:bg-transparent"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: pagination.totalPages || 1 }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors shadow-sm ${page === p
                          ? 'bg-[#3b548b] text-white border border-[#3b548b]'
                          : 'bg-white dark:bg-transparent text-[#3b548b] border border-[var(--vz-border)] hover:border-[#3b548b]'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === (pagination.totalPages || 1)}
                      className="w-8 h-8 flex items-center justify-center rounded border border-[var(--vz-border)] text-[#3b548b] hover:border-[#3b548b] disabled:opacity-40 disabled:hover:border-[var(--vz-border)] disabled:text-[var(--vz-text-muted)] transition-colors shadow-sm bg-white dark:bg-transparent"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => setPage(pagination.totalPages || 1)}
                      disabled={page === (pagination.totalPages || 1)}
                      className="w-8 h-8 flex items-center justify-center rounded border border-[var(--vz-border)] text-[#3b548b] hover:border-[#3b548b] disabled:opacity-40 disabled:hover:border-[var(--vz-border)] disabled:text-[var(--vz-text-muted)] transition-colors shadow-sm bg-white dark:bg-transparent"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="w-full sm:w-1/3 flex justify-end items-center gap-3">
                  <span className="text-sm font-medium text-[var(--vz-text-muted)]">Rows per page</span>
                  <div className="relative inline-flex items-center">
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                      className="text-sm font-medium text-[var(--vz-heading)] bg-white dark:bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:border-primary shadow-sm appearance-none cursor-pointer"
                    >
                      {[10, 15, 20, 50].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 text-[var(--vz-text-muted)] pointer-events-none" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Disposition Modal */}
      <Modal isOpen={!!showDisp} onClose={() => setShowDisp(null)} title="Update Disposition" size="sm">
        <Select
          value={disposition}
          onChange={(val) => setDisposition(val)}
          options={[
            { value: '', label: 'Select disposition' },
            ...['interested', 'not_interested', 'callback', 'converted', 'wrong_number', 'voicemail'].map((d) => ({
              value: d,
              label: d.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
            }))
          ]}
        />
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowDisp(null)}>Cancel</Button>
          <Button size="sm" onClick={handleDisposition}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
