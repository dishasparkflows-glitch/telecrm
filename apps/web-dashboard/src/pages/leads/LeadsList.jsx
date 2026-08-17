import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { openDialer } from '../../slices/uiSlice'
import { useGetLeadsQuery, useLazyGetLeadsExportQuery, useCreateLeadMutation, useImportLeadsMutation, useArchiveLeadMutation, useBulkUpdateLeadsMutation } from '../../features/leads/leadApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
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
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import {
  Search, Plus, Upload, Download, Filter, Phone, Mail as MailIcon,
  Users, Trash2, Eye, X, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import * as XLSX from 'xlsx'

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
  { value: 'assignedTo', label: 'Assigned To' },
]

const IMPORT_ALIASES = {
  firstname: 'contact.firstName', first_name: 'contact.firstName', name: 'contact.firstName',
  lastname: 'contact.lastName', last_name: 'contact.lastName', surname: 'contact.lastName',
  email: 'contact.email', emailaddress: 'contact.email', email_address: 'contact.email',
  phone: 'contact.phone', phonenumber: 'contact.phone', phone_number: 'contact.phone', mobile: 'contact.phone', mobilenumber: 'contact.phone',
  company: 'contact.company', companyname: 'contact.company', company_name: 'contact.company',
  stage: 'stage', status: 'stage', source: 'sourceDetails', sourcedetails: 'sourceDetails',
  assignedto: 'assignedTo', assigned_to: 'assignedTo', owner: 'assignedTo',
}

export default function LeadsList() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const toast = useToast()
  const activeBranchId = useSelector((s) => s.auth.activeBranchId)
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
  const [selectedLeads, setSelectedLeads] = useState([])
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState({
    enabledFields: {},
    updates: { stage: '', assignedTo: '', priority: '', followUpAt: '' }
  })
  const fileInputRef = useRef(null)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useGetLeadsQuery({
    page, limit: pageSize,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(stageFilter && { stage: stageFilter }),
    ...(sourceFilter && { source: sourceFilter }),
  })

  const { data: usersData } = useGetAllUsersListQuery({ branchId: activeBranchId === 'all' ? undefined : activeBranchId })
  const { data: fieldsData } = useGetCustomFieldsQuery({ entity: 'Lead' }, { skip: !showAdd })
  const { data: profileData } = useGetProfileQuery()
  const [createLead, { isLoading: creating }] = useCreateLeadMutation()
  const [importLeads, { isLoading: importing }] = useImportLeadsMutation()
  const [archiveLead, { isLoading: isArchiving }] = useArchiveLeadMutation()
  const [bulkUpdateLeads, { isLoading: isBulkUpdating }] = useBulkUpdateLeadsMutation()
  const [getLeadsExport, { isFetching: isExporting }] = useLazyGetLeadsExportQuery()

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
    if (!assignedTo) return 'Unassigned'
    if (typeof assignedTo === 'object' && (assignedTo.name)) {
      return assignedTo.name
    }
    const id = typeof assignedTo === 'object' ? assignedTo?._id : assignedTo
    const user = users.find((u) => u._id === id)
    return user ? (user.name || '') : 'Unassigned'
  }

  const [newLead, setNewLead] = useState({
    contact: { firstName: '', lastName: '', email: '', phone: '', countryCode: '+91', company: '' },
    pipeline: { stage: 'new' },
    stage: 'new',
    source: 'manual',
    customFields: {}
  })

  const handleCreate = async () => {
    if (!newLead.contact.firstName?.trim()) return toast('First name is required', 'error')
    if (!newLead.contact.lastName?.trim()) return toast('Last name is required', 'error')
    if (!newLead.contact.email?.trim()) return toast('Email is required', 'error')
    if (!newLead.contact.phone?.trim() || newLead.contact.phone.length !== 10) return toast('Phone number must be exactly 10 digits', 'error')

    const leadFields = fieldsData?.data || [];
    for (const field of leadFields) {
      if (field.isRequired && !newLead.customFields[field.name]) {
        return toast(`${field.label} is required`, 'error')
      }
    }

    try {
      const contactData = { ...newLead.contact };
      const payload = {
        contact: contactData,
        pipeline: { stage: newLead.pipeline?.stage || 'new' },
        source: newLead.source || 'manual',
        customFields: newLead.customFields || {}
      }
      await createLead(payload).unwrap()
      toast('Lead created successfully', 'success')
      setShowAdd(false)
      setNewLead({ contact: { firstName: '', lastName: '', email: '', phone: '', countryCode: '+91', company: '' }, pipeline: { stage: 'new' }, stage: 'new', source: 'manual', customFields: {} })
    } catch (err) {
      toast(err.data?.message || 'Failed to create lead', 'error')
    }
  }

  const handleExport = async () => {
    try {
      const result = await getLeadsExport({
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(stageFilter && { stage: stageFilter }),
        ...(sourceFilter && { source: sourceFilter }),
      }).unwrap()

      if (!result.data || result.data.length === 0) {
        return toast('No leads found to export', 'warning')
      }

      const exportData = result.data.map(lead => ({
        'First Name': lead.contact?.firstName || '',
        'Last Name': lead.contact?.lastName || '',
        'Email': lead.contact?.email || '',
        'Phone': lead.contact?.phone || '',
        'Company': lead.contact?.company || '',
        'Stage': stageLabelMap[lead.pipeline?.stage] || lead.pipeline?.stage || '',
        'Source': sourceLabels[lead.source] || lead.source || '',
        'Score': lead.scoring?.score || 0,
        'Assigned To': getAssignedName(lead.assignedTo),
        'Created Date': (lead.meta && lead.meta.createdAt) ? new Date(lead.meta.createdAt).toLocaleDateString() : (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '')
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads')
      XLSX.writeFile(workbook, 'Leads_Export.xlsx')
      
      toast('Exported successfully', 'success')
    } catch (err) {
      toast('Failed to export leads', 'error')
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      if (rows.length < 2) return toast('File must include a header row and at least one lead', 'error')
      
      const headers = rows[0].map((h, i) => String(h).trim() || `Column ${i + 1}`)
      const parsedRows = rows.slice(1).map(row => {
        return headers.reduce((record, header, index) => {
          record[header] = String(row[index] || '').trim()
          return record
        }, {})
      }).filter(row => Object.values(row).some(v => v !== ''))
      
      if (!parsedRows.length) return toast('File contains no valid data rows', 'error')
      
      const mapping = Object.fromEntries(headers.map((header) => {
        const normalized = header.toLowerCase().replace(/[^a-z0-9_]/g, '')
        return [header, IMPORT_ALIASES[normalized] || '']
      }))
      
      setImportHeaders(headers)
      setImportRows(parsedRows)
      setImportMapping(mapping)
      setShowImport(true)
    } catch (err) {
      toast('Could not read this file. Ensure it is a valid CSV or Excel file.', 'error')
    }
  }

  const handleMappedImport = async () => {
    if (!Object.values(importMapping).includes('contact.firstName')) return toast('Map one column to First Name', 'error')
    const duplicateTargets = Object.values(importMapping).filter(Boolean)
    if (new Set(duplicateTargets).size !== duplicateTargets.length) return toast('Each CRM field can only be mapped once', 'error')

    const leadsToImport = importRows.map((row) => importHeaders.reduce((lead, header) => {
      const target = importMapping[header]
      if (target) {
        if (target === 'assignedTo') {
            const val = String(row[header] || '').trim().toLowerCase()
            const matchedUser = users.find(u => u.name?.toLowerCase() === val || u.email?.toLowerCase() === val)
            if (matchedUser) {
                lead.assignedTo = matchedUser._id
            }
        } else if (target.startsWith('contact.')) {
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

  const handleBulkUpdate = async () => {
    if (selectedLeads.length === 0) return toast('No leads selected', 'warning')
    const activeUpdates = {}
    for (const [field, enabled] of Object.entries(bulkEditForm.enabledFields)) {
      if (enabled) {
        if (field === 'stage') activeUpdates.pipeline = { stage: bulkEditForm.updates.stage }
        else if (field === 'priority' || field === 'followUpAt') {
          activeUpdates.lifecycle = { ...activeUpdates.lifecycle, [field]: bulkEditForm.updates[field] }
        }
        else activeUpdates[field] = bulkEditForm.updates[field]
      }
    }
    
    if (Object.keys(activeUpdates).length === 0) {
      return toast('Please select at least one field to update', 'warning')
    }

    try {
      const res = await bulkUpdateLeads({
        leadIds: selectedLeads,
        updates: activeUpdates
      }).unwrap()
      
      toast(`Successfully updated ${res.data.modifiedCount} leads`, 'success')
      if (res.data.failedCount > 0) {
        toast(`Failed to update ${res.data.failedCount} leads`, 'error')
      }
      setShowBulkEdit(false)
      setSelectedLeads([])
      setBulkEditForm({ enabledFields: {}, updates: { stage: '', assignedTo: '', priority: '', followUpAt: '' } })
    } catch (err) {
      toast(err.data?.message || 'Failed to update leads', 'error')
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
            <Button variant="soft-primary" size="sm" onClick={handleExport} disabled={isExporting}>
              <Download size={14} /> {isExporting ? 'Exporting...' : 'Export'}
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleImportFile} />
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

      {/* Bulk Actions Toolbar */}
      {selectedLeads.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1a1b1e] border border-[var(--vz-border)] shadow-xl rounded-full px-6 py-3 flex items-center gap-6 z-40">
          <span className="text-sm font-medium text-[var(--vz-text)] bg-primary/10 text-primary px-3 py-1 rounded-full">
            {selectedLeads.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowBulkEdit(true)}>
              Bulk Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedLeads([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

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
                    <th className="px-4 py-3 text-left w-10">
                      <input 
                        type="checkbox" 
                        checked={leads.length > 0 && selectedLeads.length === leads.length}
                        ref={input => {
                          if (input) {
                            input.indeterminate = selectedLeads.length > 0 && selectedLeads.length < leads.length;
                          }
                        }}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedLeads(leads.map(l => l._id))
                          else setSelectedLeads([])
                        }}
                        className="rounded border-[var(--vz-border)] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                    </th>
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
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead._id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedLeads([...selectedLeads, lead._id])
                            else setSelectedLeads(selectedLeads.filter(id => id !== lead._id))
                          }}
                          className="rounded border-[var(--vz-border)] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        />
                      </td>
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
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const fullPhone = lead.contact?.countryCode && lead.contact?.phone ? `${lead.contact.countryCode}${lead.contact.phone}` : lead.contact?.phone;
                                dispatch(openDialer({ phone: fullPhone, leadId: lead._id })) 
                              }}
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
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Phone</label>
            <div className="flex rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-all overflow-hidden">
              <div className="bg-[var(--vz-bg-soft)] text-sm text-[var(--vz-heading)] border-r border-[var(--vz-input-border)] py-2 px-3 flex items-center gap-1.5 select-none">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                type="tel"
                maxLength={10}
                placeholder="Phone number"
                className="w-full bg-transparent text-sm text-[var(--vz-heading)] px-3 py-2 outline-none placeholder:text-[var(--vz-text-muted)]"
                value={newLead.contact.phone}
                onChange={(e) => setNewLead({ ...newLead, contact: { ...newLead.contact, phone: e.target.value.replace(/[^\d]/g, '') } })}
              />
            </div>
          </div>
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
          {fieldsData?.data?.length > 0 && (
            <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
              <h6 className="text-xs font-bold text-[var(--vz-heading)] uppercase tracking-wider text-primary">Additional Information</h6>
              <div className="grid grid-cols-2 gap-3">
                {fieldsData.data.map(field => (
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

      {/* TeleCRM Style Bulk Edit Modal */}
      <Modal isOpen={showBulkEdit} onClose={() => setShowBulkEdit(false)} title="Bulk Edit Leads" size="4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[var(--vz-border)] bg-[var(--vz-card-bg)] rounded-lg -m-4">
          
          {/* Column 1: Selected Leads */}
          <div className="p-4 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[var(--vz-heading)]">Selected Leads ({selectedLeads.length})</h3>
              <button onClick={() => setSelectedLeads([])} className="text-xs text-primary hover:underline">Clear All</button>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--vz-text-muted)]" />
              <input type="text" placeholder="Search selected leads..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--vz-input-border)] rounded bg-[var(--vz-input-bg)] text-[var(--vz-heading)] focus:border-primary outline-none" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {leads.filter(l => selectedLeads.includes(l._id)).map(lead => (
                <div key={lead._id} className="flex items-start gap-2.5 p-2 rounded hover:bg-[var(--vz-bg-soft)] group">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                    {(lead.contact?.firstName?.[0] || '')}{(lead.contact?.lastName?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--vz-heading)] truncate">
                      {lead.contact?.firstName} {lead.contact?.lastName}
                    </p>
                    <p className="text-[10px] text-[var(--vz-text-muted)] truncate">{lead.contact?.email}</p>
                    <p className="text-[10px] text-[var(--vz-text-muted)] truncate">{lead.contact?.phone}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedLeads(prev => prev.filter(id => id !== lead._id))}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--vz-text-muted)] hover:text-danger hover:bg-danger/10 rounded transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Update Fields */}
          <div className="p-4 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--vz-heading)]">Update Fields</h3>
              <button 
                onClick={() => setBulkEditForm({ enabledFields: {}, updates: { stage: '', assignedTo: '', priority: '', followUpAt: '' } })}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                 Reset All
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              
              {/* Stage */}
              <div className="border border-[var(--vz-border)] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="rounded border-[var(--vz-border)] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    checked={!!bulkEditForm.enabledFields.stage}
                    onChange={(e) => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, stage: e.target.checked } }))}
                  />
                  <div className="flex-1 grid grid-cols-3 items-center gap-2">
                    <label className="text-xs font-medium text-[var(--vz-heading)] cursor-pointer" onClick={() => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, stage: !prev.enabledFields.stage } }))}>Lead Stage</label>
                    <div className="col-span-2">
                      <Select
                        value={bulkEditForm.updates.stage}
                        onChange={(val) => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, stage: true }, updates: { ...prev.updates, stage: val } }))}
                        options={stageOptions.map(s => ({ value: s.slug, label: s.name }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Assigned User */}
              <div className="border border-[var(--vz-border)] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="rounded border-[var(--vz-border)] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    checked={!!bulkEditForm.enabledFields.assignedTo}
                    onChange={(e) => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, assignedTo: e.target.checked } }))}
                  />
                  <div className="flex-1 grid grid-cols-3 items-center gap-2">
                    <label className="text-xs font-medium text-[var(--vz-heading)] cursor-pointer" onClick={() => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, assignedTo: !prev.enabledFields.assignedTo } }))}>Assigned User</label>
                    <div className="col-span-2">
                      <Select
                        value={bulkEditForm.updates.assignedTo}
                        onChange={(val) => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, assignedTo: true }, updates: { ...prev.updates, assignedTo: val } }))}
                        options={[
                          { value: 'unassigned', label: 'Unassigned' },
                          ...users.map(u => ({ value: u._id, label: u.name || 'Unknown User' }))
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div className="border border-[var(--vz-border)] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="rounded border-[var(--vz-border)] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    checked={!!bulkEditForm.enabledFields.priority}
                    onChange={(e) => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, priority: e.target.checked } }))}
                  />
                  <div className="flex-1 grid grid-cols-3 items-center gap-2">
                    <label className="text-xs font-medium text-[var(--vz-heading)] cursor-pointer" onClick={() => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, priority: !prev.enabledFields.priority } }))}>Priority</label>
                    <div className="col-span-2">
                      <Select
                        value={bulkEditForm.updates.priority}
                        onChange={(val) => setBulkEditForm(prev => ({ ...prev, enabledFields: { ...prev.enabledFields, priority: true }, updates: { ...prev.updates, priority: val } }))}
                        options={[
                          { value: 'high', label: 'High' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'low', label: 'Low' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>


            </div>
          </div>

          {/* Column 3: Preview */}
          <div className="p-4 flex flex-col h-[600px] bg-primary/5">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
               Preview Changes
            </h3>
            
            {Object.values(bulkEditForm.enabledFields).some(Boolean) ? (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                <p className="text-xs text-[var(--vz-text)] mb-4">
                  The following changes will be applied to <strong>{selectedLeads.length}</strong> selected leads:
                </p>
                
                {bulkEditForm.enabledFields.stage && (
                  <div className="bg-white dark:bg-[var(--vz-card-bg)] p-3 rounded border border-[var(--vz-border)]">
                    <p className="text-xs font-semibold text-[var(--vz-heading)] mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Lead Stage
                    </p>
                    <p className="text-[11px] text-[var(--vz-text-muted)] ml-3">
                      Current values → <span className="font-semibold text-[var(--vz-text)]">{stageLabelMap[bulkEditForm.updates.stage] || bulkEditForm.updates.stage}</span>
                    </p>
                  </div>
                )}

                {bulkEditForm.enabledFields.assignedTo && (
                  <div className="bg-white dark:bg-[var(--vz-card-bg)] p-3 rounded border border-[var(--vz-border)]">
                    <p className="text-xs font-semibold text-[var(--vz-heading)] mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Assigned User
                    </p>
                    <p className="text-[11px] text-[var(--vz-text-muted)] ml-3">
                      Current values → <span className="font-semibold text-[var(--vz-text)]">
                        {bulkEditForm.updates.assignedTo === 'unassigned' ? 'Unassigned' : (users.find(u => u._id === bulkEditForm.updates.assignedTo)?.name || 'Unknown User')}
                      </span>
                    </p>
                  </div>
                )}

                {bulkEditForm.enabledFields.priority && (
                  <div className="bg-white dark:bg-[var(--vz-card-bg)] p-3 rounded border border-[var(--vz-border)]">
                    <p className="text-xs font-semibold text-[var(--vz-heading)] mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Priority
                    </p>
                    <p className="text-[11px] text-[var(--vz-text-muted)] ml-3">
                      Current values → <span className="font-semibold text-[var(--vz-text)] capitalize">{bulkEditForm.updates.priority}</span>
                    </p>
                  </div>
                )}


              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-full bg-[var(--vz-bg-soft)] flex items-center justify-center mb-3">
                  <Eye className="text-[var(--vz-text-muted)]" size={20} />
                </div>
                <p className="text-sm font-medium text-[var(--vz-heading)]">No fields selected</p>
                <p className="text-xs text-[var(--vz-text-muted)] mt-1">Select fields in the middle column to preview your updates here.</p>
              </div>
            )}
            
            <div className="pt-4 border-t border-[var(--vz-border)] mt-auto flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowBulkEdit(false)}>Cancel</Button>
              <Button size="sm" onClick={handleBulkUpdate} disabled={isBulkUpdating || !Object.values(bulkEditForm.enabledFields).some(Boolean)}>
                {isBulkUpdating ? 'Updating...' : `Update ${selectedLeads.length} Leads`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
