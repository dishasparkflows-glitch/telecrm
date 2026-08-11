import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { openDialer } from '../../slices/uiSlice'
import { useGetLeadsQuery, useCreateLeadMutation, useImportLeadsMutation, useArchiveLeadMutation } from '../../features/leads/leadApi'
import { useGetUsersQuery } from '../../features/users/userApi'
import { useGetCustomFieldsQuery } from '../../features/custom-fields/customFieldApi'
import { useGetProfileQuery } from '../../features/tenant/tenantApi'
import { useDebounce } from '../../hooks/useDebounce'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import {
  Search, Plus, Upload, Filter, Phone, Mail as MailIcon,
  Users, Trash2, Eye, X, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'

const stageColors = {
  new: 'primary', contacted: 'info', qualified: 'warning',
  negotiation: 'warning', won: 'success', lost: 'danger',
}

const sourceLabels = {
  manual: 'Manual', website: 'Website', facebook: 'Facebook',
  whatsapp: 'WhatsApp', csv: 'CSV Import', api: 'API',
  smart_form: 'Smart Form', referral: 'Referral',
}



const IMPORT_FIELDS = [
  { value: '', label: 'Do not import' },
  { value: 'contact.firstName', label: 'First Name' },
  { value: 'contact.lastName', label: 'Last Name' },
  { value: 'contact.email', label: 'Email' },
  { value: 'contact.phone', label: 'Phone' },
  { value: 'contact.company', label: 'Company' },
  { value: 'stage', label: 'Stage' },
  { value: 'sourceDetails', label: 'Source Details' },
]

const IMPORT_ALIASES = {
  firstname: 'contact.firstName', first_name: 'contact.firstName', name: 'contact.firstName',
  lastname: 'contact.lastName', last_name: 'contact.lastName', surname: 'contact.lastName',
  email: 'contact.email', emailaddress: 'contact.email', email_address: 'contact.email',
  phone: 'contact.phone', phonenumber: 'contact.phone', phone_number: 'contact.phone', mobile: 'contact.phone', mobilenumber: 'contact.phone',
  company: 'contact.company', companyname: 'contact.company', company_name: 'contact.company',
  stage: 'stage', status: 'stage', source: 'sourceDetails', sourcedetails: 'sourceDetails',
}

export default function LeadsList() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importHeaders, setImportHeaders] = useState([])
  const [importRows, setImportRows] = useState([])
  const [importMapping, setImportMapping] = useState({})
  const [leadToArchive, setLeadToArchive] = useState(null)
  const fileInputRef = useRef(null)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useGetLeadsQuery({
    page, limit: pageSize,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(stageFilter && { stage: stageFilter }),
    ...(sourceFilter && { source: sourceFilter }),
  })

  const { data: usersData } = useGetUsersQuery()
  const { data: fieldsData } = useGetCustomFieldsQuery()
  const { data: profileData } = useGetProfileQuery()
  const [createLead, { isLoading: creating }] = useCreateLeadMutation()
  const [importLeads, { isLoading: importing }] = useImportLeadsMutation()
  const [archiveLead, { isLoading: isArchiving }] = useArchiveLeadMutation()

  const leads = data?.data || []
  const pagination = data?.pagination || {}
  const users = usersData?.data || []
  const stageOptions = useMemo(() => {
    const configured = profileData?.data?.pipelineStages
    if (configured?.length) return [...configured].sort((a, b) => (a.order || 0) - (b.order || 0))
    return Object.keys(stageColors).map((slug, order) => ({ slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), order }))
  }, [profileData])
  const stageLabelMap = useMemo(() => Object.fromEntries(stageOptions.map((s) => [s.slug, s.name])), [stageOptions])
  const getAssignedName = (assignedTo) => {
    const id = typeof assignedTo === 'object' ? assignedTo?._id : assignedTo
    const user = users.find((u) => u._id === id)
    return user ? `${user.name || ''}` : 'Unassigned'
  }

  const [newLead, setNewLead] = useState({
    contact: { firstName: '', lastName: '', email: '', phone: '', company: '' },
    pipeline: { stage: 'new' },
    stage: 'new',
    source: 'manual',
    customFields: {}
  })

  const handleCreate = async () => {
    try {
      const payload = {
        contact: newLead.contact,
        pipeline: { stage: newLead.pipeline?.stage || 'new' },
        source: newLead.source || 'manual',
        customFields: newLead.customFields || {}
      }
      await createLead(payload).unwrap()
      toast('Lead created successfully', 'success')
      setShowAdd(false)
      setNewLead({ contact: { firstName: '', lastName: '', email: '', phone: '', company: '' }, pipeline: { stage: 'new' }, stage: 'new', source: 'manual', customFields: {} })
    } catch (err) {
      toast(err.data?.message || 'Failed to create lead', 'error')
    }
  }

  const parseCsvLine = (line) => {
    const values = []
    let value = ''
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      if (character === '"' && quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        quoted = !quoted
      } else if (character === ',' && !quoted) {
        values.push(value.trim())
        value = ''
      } else {
        value += character
      }
    }
    values.push(value.trim())
    return values
  }

  const parseCsv = (text) => {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = parseCsvLine(lines[0]).map((header, index) => header || `Column ${index + 1}`)
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line)
      return headers.reduce((record, header, index) => ({ ...record, [header]: values[index] || '' }), {})
    })
    return { headers, rows }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = parseCsv(await file.text())
      if (!parsed.rows.length) return toast('CSV must include a header row and at least one lead', 'error')
      const mapping = Object.fromEntries(parsed.headers.map((header) => {
        const normalized = header.toLowerCase().replace(/[^a-z0-9_]/g, '')
        return [header, IMPORT_ALIASES[normalized] || '']
      }))
      setImportHeaders(parsed.headers)
      setImportRows(parsed.rows)
      setImportMapping(mapping)
      setShowImport(true)
    } catch {
      toast('Could not read this CSV file', 'error')
    }
  }

  const handleMappedImport = async () => {
    if (!Object.values(importMapping).includes('contact.firstName')) return toast('Map one column to First Name', 'error')
    const duplicateTargets = Object.values(importMapping).filter(Boolean)
    if (new Set(duplicateTargets).size !== duplicateTargets.length) return toast('Each CRM field can only be mapped once', 'error')

    const leadsToImport = importRows.map((row) => importHeaders.reduce((lead, header) => {
      const target = importMapping[header]
      if (target) {
        if (target.startsWith('contact.')) {
            const field = target.split('.')[1]
            if (!lead.contact) lead.contact = {}
            lead.contact[field] = row[header]
        } else {
            lead[target] = row[header]
        }
      }
      return lead
    }, { source: 'csv' }))

    try {
      const result = await importLeads({ leads: leadsToImport }).unwrap()
      toast(result?.message || 'Import complete', 'success')
      setShowImport(false)
    } catch (err) {
      toast(err.data?.message || 'Failed to import leads', 'error')
    }
  }

  const handleArchive = (id, e) => {
    e.stopPropagation()
    setLeadToArchive(id)
  }

  const confirmArchive = async () => {
    try {
      await archiveLead(leadToArchive).unwrap()
      toast('Lead archived', 'success')
      setLeadToArchive(null)
    } catch {
      toast('Failed to archive lead', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Leads' }]}
      />

      {/* Actions Bar */}
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-[280px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)]
                  text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] outline-none
                  focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-md border transition-colors ${showFilters
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-[var(--vz-input-border)] text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)]'}`}
            >
              <Filter size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
            <Button variant="soft-primary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload size={14} /> {importing ? 'Importing...' : 'Import'}
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Lead
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-[var(--vz-border)]">
            <div className="w-40">
              <Select
                value={stageFilter}
                onChange={(val) => { setStageFilter(val); setPage(1) }}
                options={[
                  { value: '', label: 'All Stages' },
                  ...stageOptions.map(s => ({ value: s.slug, label: s.name }))
                ]}
              />
            </div>

            <div className="w-40">
              <Select
                value={sourceFilter}
                onChange={(val) => { setSourceFilter(val); setPage(1) }}
                options={[
                  { value: '', label: 'All Sources' },
                  ...Object.entries(sourceLabels).map(([k, v]) => ({ value: k, label: v }))
                ]}
              />
            </div>

            {(stageFilter || sourceFilter) && (
              <button
                onClick={() => { setStageFilter(''); setSourceFilter(''); setPage(1) }}
                className="text-xs text-danger hover:underline inline-flex items-center gap-1"
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Leads Table */}
      <Card noPadding>
        {isLoading ? (
          <div className="p-8 text-center text-[var(--vz-text-muted)]">Loading leads...</div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads found"
            description={search ? 'Try adjusting your search or filters' : 'Create your first lead to get started'}
            action={!search && <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Lead</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[var(--vz-table-header-bg)]">
                    {['Name', 'Contact', 'Company', 'Stage', 'Source', 'Score', 'Assigned To', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead._id}
                      onClick={() => navigate(`/leads/${lead._id}`)}
                      className="border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {(lead.contact?.firstName?.[0] || '')}{(lead.contact?.lastName?.[0] || '')}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--vz-heading)] leading-tight">
                              {lead.contact?.firstName} {lead.contact?.lastName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">
                        <div className="flex flex-col gap-0.5">
                          {lead.contact?.email && <span className="flex items-center gap-1 text-xs"><MailIcon size={11} /> {lead.contact?.email}</span>}
                          {lead.contact?.phone && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); dispatch(openDialer({ phone: lead.contact?.phone, leadId: lead._id })) }}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Phone size={11} /> {lead.contact?.phone}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{lead.contact?.company || '—'}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const currentStage = lead.pipeline?.stage;
                          return (
                            <Badge color={stageColors[currentStage] || 'primary'}>
                              {stageLabelMap[currentStage] || currentStage?.charAt(0).toUpperCase() + currentStage?.slice(1)}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)] text-xs">
                        {sourceLabels[lead.source] || lead.source}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const s = lead.scoring?.score ?? 0;
                          return (
                            <div className="flex items-center gap-1.5">
                              <div className="w-8 h-1.5 bg-[var(--vz-input-bg)] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    s >= 70 ? 'bg-secondary' :
                                    s >= 40 ? 'bg-warning' : 'bg-danger'
                                  }`}
                                  style={{ width: `${s}%` }}
                                />
                              </div>
                              <span className="text-xs text-[var(--vz-text-muted)]">{s}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)] text-xs">
                        {getAssignedName(lead.assignedTo)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead._id}`) }}
                            className="p-1.5 rounded text-[var(--vz-text-muted)] hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => handleArchive(lead._id, e)}
                            className="p-1.5 rounded text-danger hover:text-danger-dark hover:bg-danger/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-[var(--vz-border)] bg-white dark:bg-[var(--vz-card-bg)]">
                <p className="text-sm font-medium text-[var(--vz-text-muted)] w-full sm:w-1/3 text-left">
                  Showing {Math.min((page - 1) * pageSize + 1, pagination.total)} to {Math.min(page * pageSize, pagination.total)} of {pagination.total} leads
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
                        className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors shadow-sm ${
                          page === p
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
                      {[10, 20, 50, 100].map((size) => (
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

      {/* Import Mapping Modal */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Map CSV Columns" size="lg">
        <div className="space-y-5">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-[var(--vz-text)]">
            {importRows.length} rows detected. Match each CSV column to a CRM field. First Name is required; unmapped columns are ignored.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {importHeaders.map((header) => (
              <div key={header} className="p-3 rounded-lg border border-[var(--vz-border)]">
                <p className="text-xs font-semibold text-[var(--vz-heading)] mb-2 truncate" title={header}>{header}</p>
                <Select
                  value={importMapping[header] || ''}
                  onChange={(val) => setImportMapping({ ...importMapping, [header]: val })}
                  options={IMPORT_FIELDS.map((field) => ({ value: field.value || 'skip', label: field.label }))}
                />
                <p className="mt-1 text-[10px] text-[var(--vz-text-muted)] truncate">Example: {importRows[0]?.[header] || '—'}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-[var(--vz-border)] rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-[var(--vz-table-header-bg)]">
                <tr>{importHeaders.slice(0, 5).map((header) => <th key={header} className="px-3 py-2 text-left">{header}</th>)}</tr>
              </thead>
              <tbody>
                {importRows.slice(0, 3).map((row, index) => (
                  <tr key={index} className="border-t border-[var(--vz-border)]">
                    {importHeaders.slice(0, 5).map((header) => <td key={header} className="px-3 py-2 max-w-40 truncate">{row[header] || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
          <Button size="sm" onClick={handleMappedImport} disabled={importing}>
            {importing ? 'Importing...' : `Import ${importRows.length} Leads`}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Lead Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Lead" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" placeholder="First name" value={newLead.contact.firstName}
              onChange={(e) => setNewLead({ ...newLead, contact: { ...newLead.contact, firstName: e.target.value } })} />
            <Input label="Last Name" placeholder="Last name" value={newLead.contact.lastName}
              onChange={(e) => setNewLead({ ...newLead, contact: { ...newLead.contact, lastName: e.target.value } })} />
          </div>
          <Input label="Email" type="email" placeholder="Email address" icon={MailIcon} value={newLead.contact.email}
            onChange={(e) => setNewLead({ ...newLead, contact: { ...newLead.contact, email: e.target.value } })} />
          <Input label="Phone" placeholder="Phone number" icon={Phone} value={newLead.contact.phone}
            onChange={(e) => setNewLead({ ...newLead, contact: { ...newLead.contact, phone: e.target.value.replace(/[^\d\+\-\(\)\s]/g, '') } })} />
          <Input label="Company" placeholder="Company name" value={newLead.contact.company}
            onChange={(e) => setNewLead({ ...newLead, contact: { ...newLead.contact, company: e.target.value } })} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Stage</label>
              <Select
                value={newLead.stage}
                onChange={(val) => setNewLead({ ...newLead, stage: val })}
                options={stageOptions.map(s => ({ value: s.slug, label: s.name }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Source</label>
              <Select
                value={newLead.source}
                onChange={(val) => setNewLead({ ...newLead, source: val })}
                options={Object.entries(sourceLabels).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
          </div>

          {/* Dynamic Custom Fields */}
          {fieldsData?.data?.filter(f => f.targetEntity === 'Lead').length > 0 && (
            <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
              <h6 className="text-xs font-bold text-[var(--vz-heading)] uppercase tracking-wider text-primary">Additional Information</h6>
              <div className="grid grid-cols-2 gap-3">
                {fieldsData.data.filter(f => f.targetEntity === 'Lead').map(field => (
                  <div key={field._id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-[var(--vz-heading)] mb-1.5">{field.name} {field.required && <span className="text-danger">*</span>}</label>
                    {field.type === 'textarea' ? (
                      <textarea 
                        className="w-full px-3 py-2 text-sm rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] outline-none focus:border-primary min-h-[80px]"
                        value={newLead.customFields[field.name] || ''}
                        onChange={(e) => setNewLead({ ...newLead, customFields: { ...newLead.customFields, [field.name]: e.target.value } })}
                      />
                    ) : (
                      <Input 
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        placeholder={field.name}
                        value={newLead.customFields[field.name] || ''}
                        onChange={(e) => setNewLead({ ...newLead, customFields: { ...newLead.customFields, [field.name]: e.target.value } })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={creating || !newLead.contact?.firstName}>
            {creating ? 'Creating...' : 'Create Lead'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        isOpen={!!leadToArchive}
        title="Archive Lead?"
        message="Are you sure you want to archive this lead? It will be removed from your active leads view."
        confirmText="Archive"
        variant="danger"
        loading={isArchiving}
        onConfirm={confirmArchive}
        onCancel={() => setLeadToArchive(null)}
      />
    </>
  )
}
