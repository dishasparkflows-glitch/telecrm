import { useState, useMemo } from 'react'
import {
  useGetFormsQuery,
  useCreateFormMutation,
  useUpdateFormMutation,
  useDeleteFormMutation,
  useGetSubmissionsQuery
} from '../../features/forms/formApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import {
  FileText,
  Plus,

  BarChart3,
  ExternalLink,
  Settings,
  Trash2,

  GripVertical,
  MousePointer2,
  Table as TableIcon,
  Code as CodeIcon,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react'

/* ---------- Field Builder Row ---------- */
const FieldRow = ({ field, onUpdate, onRemove }) => (
  <div className="flex items-center gap-3 p-3 bg-[var(--vz-body-bg)] rounded-lg border border-[var(--vz-border)] group">
    <div className="text-[var(--vz-text-muted)] cursor-grab">
      <GripVertical size={16} />
    </div>
    <div className="flex-1 grid grid-cols-12 gap-2">
      <div className="col-span-4">
        <input
          placeholder="Field Label"
          value={field.label || ''}
          onChange={(e) => onUpdate({ ...field, label: e.target.value })}
          className="w-full bg-transparent text-sm font-semibold text-[var(--vz-heading)] outline-none"
        />
      </div>
      <div className="col-span-3">
        <select
          value={field.type || 'text'}
          onChange={(e) => onUpdate({ ...field, type: e.target.value })}
          className="w-full bg-transparent text-xs text-[var(--vz-text-muted)] outline-none border-none p-0 cursor-pointer"
        >
          <option value="text">Short Text</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="date">Date</option>
          <option value="textarea">Long Text</option>
          <option value="number">Number</option>
        </select>
      </div>
      <div className="col-span-4">
        <input
          placeholder="Name attribute (e.g. user_email)"
          value={field.name || ''}
          onChange={(e) => onUpdate({ ...field, name: e.target.value })}
          className="w-full bg-transparent text-[11px] text-[var(--vz-text-muted)] italic outline-none"
        />
      </div>
      <div className="col-span-1 flex justify-center">
         <input 
           type="checkbox" 
           title="Required" 
           checked={field.required || false} 
           onChange={(e) => onUpdate({ ...field, required: e.target.checked })} 
           className="accent-primary"
         />
      </div>
    </div>
    <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 p-1.5 text-danger hover:bg-danger/10 rounded transition-all">
       <Trash2 size={14} />
    </button>
  </div>
)

/* ---------- Main Component ---------- */

export default function SmartForms() {
  const toast = useToast()
  
  // UI States
  const [showCreate, setShowCreate] = useState(false)
  const [viewingSubmissions, setViewingSubmissions] = useState(null) // Form ID
  const [editingForm, setEditingForm] = useState(null) // Full Form Object
  const [formName, setFormName] = useState('')

  // Queries/Mutations
  const { data, isLoading } = useGetFormsQuery()
  const [createForm, { isLoading: creating }] = useCreateFormMutation()
  const [updateForm, { isLoading: updating }] = useUpdateFormMutation()
  const [deleteForm] = useDeleteFormMutation()
  const { data: submissionsData, isLoading: subLoading } = useGetSubmissionsQuery(
    { id: viewingSubmissions }, 
    { skip: !viewingSubmissions }
  )

  const forms = data?.data || []
  const currentSubmissions = submissionsData?.data || []
  const currentFormForSubs = forms.find(f => f._id === viewingSubmissions)

  const handleCreate = async () => {
    if (!formName) return
    try {
      const res = await createForm({ name: formName, fields: [] }).unwrap()
      toast('Structure created. Now add some fields!', 'success')
      setShowCreate(false)
      setFormName('')
      setEditingForm(res.data)
    } catch {
      toast('Failed to create form', 'error')
    }
  }

  const handleSaveFields = async () => {
    try {
      await updateForm({
        id: editingForm._id,
        name: editingForm.name,
        fields: editingForm.fields.map((field) => ({
          label: field.label,
          name: field.name,
          type: field.type,
          placeholder: field.placeholder,
          required: field.required,
          options: field.options,
          order: field.order,
        })),
        isActive: editingForm.isActive
      }).unwrap()
      toast('Form schema updated', 'success')
      setEditingForm(null)
    } catch {
      toast('Failed to save fields', 'error')
    }
  }

  const handleDeleteForm = async (id) => {
    if (!confirm('Are you sure you want to delete this form? All submissions will also be deleted.')) return
    try {
      await deleteForm(id).unwrap()
      toast('Form deleted', 'success')
    } catch {
      toast('Failed to delete form', 'error')
    }
  }

  const addField = () => {
    const newField = { label: '', name: '', type: 'text', required: false }
    setEditingForm({ ...editingForm, fields: [...(editingForm.fields || []), newField] })
  }

  const copyEmbed = (id) => {
    const code = `<iframe src="${window.location.origin}/api/forms/${id}/submit" width="100%" height="600px" frameborder="0"></iframe>`
    navigator.clipboard.writeText(code)
    toast('Embed code copied!', 'success')
  }

  const copyPublicLink = (id) => {
    const link = `${window.location.origin}/api/forms/${id}/preview` // Assuming a preview/direct link exists
    navigator.clipboard.writeText(link)
    toast('Public link copied!', 'success')
  }

  // Dynamic headers for submissions
  const subHeaders = useMemo(() => {
    if (!currentFormForSubs?.fields) return []
    return currentFormForSubs.fields.map(f => ({ label: f.label, key: f.name }))
  }, [currentFormForSubs])

  return (
    <div className="space-y-6">
      <PageHeader title="Smart Forms" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Forms' }]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <h5 className="text-xl font-black text-[var(--vz-heading)]">Manage Forms</h5>
           <Badge color="info">{forms.length} Total</Badge>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} variant="primary" className="shadow-lg">
          <Plus size={16} className="mr-1.5" /> Create New Form
        </Button>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Loader2 size={32} className="text-primary animate-spin" />
        </div>
      ) : forms.length === 0 ? (
        <Card className="bg-primary/5 border-dashed border-2 border-primary/20">
          <EmptyState 
            icon={FileText} 
            title="Create Your First Form" 
            description="Capture leads directly into your pipeline by embedding custom forms onto your website."
            action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} className="mr-1" /> Get Started</Button>} 
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => (
            <Card key={form._id} className="relative group hover:border-primary/50 transition-all duration-300 shadow-sm border-[var(--vz-border)]">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div className="flex items-center gap-2">
                   <Badge color={form.isActive ? 'success' : 'dark'}>{form.isActive ? 'Accepting Leads' : 'Draft'}</Badge>
                   <button onClick={() => setEditingForm(form)} className="p-1.5 rounded hover:bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)] hover:text-primary transition-colors" title="Settings">
                      <Settings size={14} />
                   </button>
                   <button onClick={() => handleDeleteForm(form._id)} className="p-1.5 rounded hover:bg-danger/10 text-[var(--vz-text-muted)] hover:text-danger transition-colors" title="Delete">
                      <Trash2 size={14} />
                   </button>
                </div>
              </div>

              <h6 className="text-base font-bold text-[var(--vz-heading)] mb-1 truncate">{form.name}</h6>
              <p className="text-xs text-[var(--vz-text-muted)] mb-4">{form.fields?.length || 0} fields configured</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                 <div className="p-2.5 rounded-lg bg-[var(--vz-body-bg)] border border-[var(--vz-border)] text-center">
                    <p className="text-[10px] text-[var(--vz-text-muted)] font-bold uppercase tracking-widest mb-1">Submissions</p>
                    <p className="text-lg font-black text-primary">{form.submissionCount || 0}</p>
                 </div>
                 <div className="p-2.5 rounded-lg bg-[var(--vz-body-bg)] border border-[var(--vz-border)] text-center">
                    <p className="text-[10px] text-[var(--vz-text-muted)] font-bold uppercase tracking-widest mb-1">Created</p>
                    <p className="text-sm font-semibold text-[var(--vz-heading)]">{new Date(form.createdAt).toLocaleDateString()}</p>
                 </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-[var(--vz-border)]">
                <Button variant="soft-info" size="sm" className="flex-1" onClick={() => setViewingSubmissions(form._id)}>
                  <BarChart3 size={14} className="mr-1.5" /> Analytics
                </Button>
                <div className="flex items-center gap-1">
                   <button onClick={() => copyEmbed(form._id)} title="Copy Embed Code" className="p-2 rounded-lg hover:bg-primary/10 text-[var(--vz-text-muted)] hover:text-primary transition-colors">
                      <CodeIcon size={16} />
                   </button>
                   <button onClick={() => copyPublicLink(form._id)} title="Public URL" className="p-2 rounded-lg hover:bg-secondary/10 text-[var(--vz-text-muted)] hover:text-secondary transition-colors">
                      <ExternalLink size={16} />
                   </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Builder Modal */}
      {editingForm && (
        <Modal isOpen onClose={() => setEditingForm(null)} title={`Form Builder: ${editingForm.name}`} size="lg">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <h6 className="text-sm font-bold text-[var(--vz-heading)]">Define Form Schema</h6>
                  <p className="text-[11px] text-[var(--vz-text-muted)]">Add the fields you want to collect from your users</p>
               </div>
               <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--vz-text-muted)] cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={editingForm.isActive} 
                       onChange={(e) => setEditingForm({...editingForm, isActive: e.target.checked})} 
                       className="rounded text-primary"
                     />
                     Active
                  </label>
                  <Button size="sm" variant="soft-primary" onClick={addField}>
                    <Plus size={14} /> Add Field
                  </Button>
               </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {editingForm.fields?.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[var(--vz-border)] rounded-xl">
                   <MousePointer2 size={32} className="mx-auto text-[var(--vz-text-muted)] mb-3 opacity-30" />
                   <p className="text-sm text-[var(--vz-text-muted)]">No fields added yet. Click 'Add Field' to start.</p>
                </div>
              ) : (
                editingForm.fields.map((field, i) => (
                  <FieldRow 
                    key={i} 
                    field={field} 
                    index={i} 
                    onUpdate={(updated) => {
                      const newFields = [...editingForm.fields]
                      newFields[i] = updated
                      setEditingForm({ ...editingForm, fields: newFields })
                    }}
                    onRemove={() => {
                      const newFields = editingForm.fields.filter((_, idx) => idx !== i)
                      setEditingForm({ ...editingForm, fields: newFields })
                    }}
                  />
                ))
              )}
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
               <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                     <CheckCircle2 size={16} className="text-primary" />
                  </div>
                  <div>
                    <h6 className="text-xs font-bold text-primary mb-1">Pro Tip: Field Names</h6>
                    <p className="text-[10px] text-[var(--vz-text)] leading-relaxed">
                      Use simple, alphanumeric names for the "Name" attribute (e.g. `client_name`). These will be the keys in your lead data.
                    </p>
                  </div>
               </div>
            </div>
          </div>
          <Modal.Footer>
            <Button variant="ghost" size="sm" onClick={() => setEditingForm(null)}>Discard Changes</Button>
            <Button size="sm" onClick={handleSaveFields} disabled={updating}>
              {updating ? 'Saving Schema...' : 'Save & Publish'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Submissions View Modal */}
      {viewingSubmissions && (
        <Modal isOpen onClose={() => setViewingSubmissions(null)} title={`Submissions: ${currentFormForSubs?.name}`} size="xl">
          <div className="space-y-4">
             <div className="flex items-center justify-between bg-[var(--vz-body-bg)] p-4 rounded-xl border border-[var(--vz-border)]">
                <div className="flex gap-6">
                   <div>
                      <p className="text-[10px] text-[var(--vz-text-muted)] font-black uppercase tracking-widest mb-1">Total Entries</p>
                      <p className="text-lg font-bold text-[var(--vz-heading)]">{currentSubmissions.length}</p>
                   </div>
                   <div>
                      <p className="text-[10px] text-[var(--vz-text-muted)] font-black uppercase tracking-widest mb-1">Last Updated</p>
                      <p className="text-lg font-bold text-[var(--vz-heading)]">
                        {currentSubmissions.length > 0 ? new Date(currentSubmissions[0].createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                   </div>
                </div>
                <Button variant="soft-primary" size="sm"><TableIcon size={14} className="mr-1.5" /> Export CSV</Button>
             </div>

             {subLoading ? (
               <div className="py-20 flex justify-center">
                 <Loader2 size={32} className="text-primary animate-spin" />
               </div>
             ) : currentSubmissions.length === 0 ? (
               <div className="text-center py-20 border-2 border-dashed border-[var(--vz-border)] rounded-xl">
                 <FileText size={48} className="mx-auto text-[var(--vz-text-muted)] mb-4 opacity-20" />
                 <h5 className="text-sm font-bold text-[var(--vz-heading)]">No Submissions Yet</h5>
                 <p className="text-xs text-[var(--vz-text-muted)]">Wait for users to start filling your form.</p>
               </div>
             ) : (
               <div className="overflow-x-auto max-h-[500px] border border-[var(--vz-border)] rounded-xl">
                 <table className="w-full text-sm">
                   <thead>
                     <tr className="bg-[var(--vz-table-header-bg)] border-b border-[var(--vz-border)]">
                       <th className="px-4 py-3 text-left text-xs font-bold text-[var(--vz-text-muted)]">#</th>
                       {subHeaders.map(h => (
                         <th key={h.key} className="px-4 py-3 text-left text-xs font-bold text-[var(--vz-text-muted)]">{h.label}</th>
                       ))}
                       <th className="px-4 py-3 text-left text-xs font-bold text-[var(--vz-text-muted)]">Submission Date</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[var(--vz-border)]">
                     {currentSubmissions.map((sub, i) => (
                       <tr key={sub._id} className="hover:bg-[var(--vz-body-bg)]/50 transition-colors">
                         <td className="px-4 py-3 text-[var(--vz-text-muted)] font-mono text-xs">{i + 1}</td>
                         {subHeaders.map(h => (
                           <td key={h.key} className="px-4 py-3 text-[var(--vz-heading)] font-medium">
                              {/* Handle objects/arrays if they exist, but usually it's primitive */}
                              {typeof sub.data[h.key] === 'object' ? JSON.stringify(sub.data[h.key]) : (sub.data[h.key] || '—')}
                           </td>
                         ))}
                         <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs">
                           {new Date(sub.createdAt).toLocaleString()}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
          <Modal.Footer>
             <Button variant="ghost" size="sm" onClick={() => setViewingSubmissions(null)}>Close</Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Interaction Form" size="sm">
        <div className="space-y-4 py-2">
           <Input 
             label="Internal Form Name" 
             placeholder="e.g. Website Contact Form" 
             value={formName} 
             onChange={(e) => setFormName(e.target.value)} 
           />
           <p className="text-[11px] text-[var(--vz-text-muted)] leading-relaxed">
             This name is used for internal tracking. You can define the user-facing field labels in the builder afterwards.
           </p>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={creating || !formName}>
            {creating ? 'Creating...' : 'Initialize Form'}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  )
}
