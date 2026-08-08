import { useState } from 'react'
import { useListBranchesQuery, useCreateBranchMutation, useUpdateBranchMutation, useDeleteBranchMutation } from '../../features/branches/branchApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Building2, Plus, Trash2, Edit3, MapPin, Phone, Mail } from 'lucide-react'

const emptyForm = { name: '', code: '', phone: '', email: '', address: { street: '', city: '', state: '', country: 'India', pincode: '' } }

export default function BranchManager() {
  const toast = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })

  const { data, isLoading } = useListBranchesQuery()
  const [createBranch, { isLoading: creating }] = useCreateBranchMutation()
  const [updateBranch, { isLoading: updating }] = useUpdateBranchMutation()
  const [deleteBranch, { isLoading: deletingBranch }] = useDeleteBranchMutation()
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, branch: null })

  const branches = data?.data || []

  const openCreate = () => { setForm({ ...emptyForm }); setEditId(null); setShowCreate(true) }
  const openEdit = (b) => {
    setForm({ name: b.name, code: b.code, phone: b.phone || '', email: b.email || '', address: b.address || emptyForm.address })
    setEditId(b._id)
    setShowCreate(true)
  }

  const handleSave = async () => {
    try {
      if (editId) {
        await updateBranch({ id: editId, ...form }).unwrap()
        toast('Branch updated', 'success')
      } else {
        await createBranch(form).unwrap()
        toast('Branch created', 'success')
      }
      setShowCreate(false)
    } catch (err) { toast(err.data?.message || 'Failed', 'error') }
  }

  const handleDelete = async () => {
    if (!confirmDelete.branch) return
    try { 
      await deleteBranch(confirmDelete.branch._id).unwrap()
      toast('Branch deactivated', 'success')
      setConfirmDelete({ isOpen: false, branch: null })
    }
    catch { toast('Failed', 'error') }
  }

  const setAddr = (k, v) => setForm({ ...form, address: { ...form.address, [k]: v } })

  return (
    <>
      <PageHeader title="Branches" breadcrumbs={[{ label: 'Admin', path: '/admin/roles' }, { label: 'Branches' }]} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--vz-text-muted)]">{branches.length} branches</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Add Branch</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-[var(--vz-text-muted)]">Loading...</div>
      ) : branches.length === 0 ? (
        <Card><EmptyState icon={Building2} title="No branches" description="Create your first branch to get started"
          action={<Button size="sm" onClick={openCreate}><Plus size={14} /> Add Branch</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <Card key={b._id} className="hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 size={20} className="text-primary" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-[var(--vz-heading)]">{b.name}</h5>
                    <p className="text-xs text-[var(--vz-text-muted)]">Code: {b.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {b.isDefault && <Badge color="primary">Default</Badge>}
                  <Badge color={b.isActive ? 'success' : 'dark'}>{b.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>

              {(b.address?.city || b.phone || b.email) && (
                <div className="space-y-1.5 mb-3 text-xs text-[var(--vz-text)]">
                  {b.address?.city && (
                    <p className="flex items-center gap-1.5"><MapPin size={12} className="text-[var(--vz-text-muted)]" /> {[b.address.street, b.address.city, b.address.state].filter(Boolean).join(', ')}</p>
                  )}
                  {b.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-[var(--vz-text-muted)]" /> {b.phone}</p>}
                  {b.email && <p className="flex items-center gap-1.5"><Mail size={12} className="text-[var(--vz-text-muted)]" /> {b.email}</p>}
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-[var(--vz-border)]">
                <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Edit3 size={12} /> Edit</Button>
                {!b.isDefault && (
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete({ isOpen: true, branch: b })}><Trash2 size={12} /> Remove</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={editId ? 'Edit Branch' : 'Add Branch'} size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Branch Name" placeholder="e.g. Mumbai Office" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Code" placeholder="e.g. MUM" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={!!editId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d\+\-\(\)\s]/g, '') })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Input label="Street" value={form.address.street} onChange={(e) => setAddr('street', e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="City" value={form.address.city} onChange={(e) => setAddr('city', e.target.value)} />
            <Input label="State" value={form.address.state} onChange={(e) => setAddr('state', e.target.value)} />
            <Input label="Pincode" value={form.address.pincode} onChange={(e) => setAddr('pincode', e.target.value)} />
          </div>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={creating || updating || !form.name || !form.code}>
            {creating || updating ? 'Saving...' : editId ? 'Update' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title={`Deactivate Branch "${confirmDelete.branch?.name}"?`}
        message="This branch will be deactivated. You can reactivate it later."
        confirmText="Deactivate"
        variant="danger"
        loading={deletingBranch}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, branch: null })}
      />
    </>
  )
}
