import { useState } from 'react'
import { Shield, Plus, Pencil, Trash2, ChevronRight, Loader2 } from 'lucide-react'
import {
  useListRolesQuery, useCreateRoleMutation,
  useUpdateRoleMutation, useDeleteRoleMutation,
} from '../../features/roles/roleApi'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/Toast'

export default function RolesList() {
  const toast = useToast()
  const { data: rolesResp, isLoading } = useListRolesQuery()
  const [createRole, { isLoading: creating }] = useCreateRoleMutation()
  const [deleteRole, { isLoading: deleting }] = useDeleteRoleMutation()
  const [updateRole, { isLoading: updating }] = useUpdateRoleMutation()
  const [showCreate, setShowCreate] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const [showEdit, setShowEdit] = useState(false)
  const [editRoleForm, setEditRoleForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, role: null })

  const roles = rolesResp?.data || []

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newRole.name.trim()) return
    try {
      await createRole(newRole).unwrap()
      setNewRole({ name: '', description: '' })
      setShowCreate(false)
    } catch (err) {
      toast(err.data?.message || 'Failed to create role', 'error')
    }
  }
  const handleDelete = async () => {
    if (!confirmDelete.role) return
    try {
      await deleteRole(confirmDelete.role._id).unwrap()
      setConfirmDelete({ isOpen: false, role: null })
    } catch (err) {
      toast(err.data?.message || 'Failed to delete role', 'error')
    }
  }

  const handleEdit = (role) => {
    setEditRoleForm({
        id: role._id,
        name: role.name,
        description: role.description || ''
    })
    setShowEdit(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
        const { id, ...data } = editRoleForm
        await updateRole({ id, ...data }).unwrap()
        setShowEdit(false)
        setEditRoleForm(null)
    } catch (err) {
        toast(err.data?.message || 'Failed to update role', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--vz-heading)] flex items-center gap-2">
            <Shield size={22} className="text-primary" />
            Roles & Permissions
          </h1>
          <p className="text-sm text-[var(--vz-text-muted)] mt-1">
            Create roles and configure module-level permissions for your team
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} variant="primary" size="sm">
          <Plus size={16} className="mr-1" /> New Role
        </Button>
      </div>

      {/* Create Role Form */}
      {showCreate && (
        <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg p-5" style={{ boxShadow: 'var(--vz-shadow)' }}>
          <h3 className="text-sm font-semibold text-[var(--vz-heading)] mb-4">Create New Role</h3>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Role name (e.g. Sales Manager)"
              value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              className="flex-1"
            />
            <Input
              placeholder="Description (optional)"
              value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Roles Table */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg overflow-x-auto" style={{ boxShadow: 'var(--vz-shadow)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--vz-border)]">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Role</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Description</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Type</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Permissions</th>
              <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vz-border)]">
            {roles.map((role) => (
              <tr key={role._id} className="hover:bg-[var(--vz-body-bg)]/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className={role.isSystem ? 'text-primary' : 'text-[var(--vz-text-muted)]'} />
                    <span className="font-medium text-[var(--vz-heading)]">{role.name}</span>
                    {role.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Default</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-[var(--vz-text-muted)] max-w-[200px] truncate">
                  {role.description || '—'}
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    role.isSystem ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                  }`}>
                    {role.isSystem ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="px-5 py-4 text-[var(--vz-text-muted)]">
                  {role.permissions?.length || 0} modules
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/admin/roles/${role._id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Permissions <ChevronRight size={14} />
                    </a>
                    <button
                      onClick={() => handleEdit(role)}
                      className="p-1.5 rounded hover:bg-primary/10 text-[var(--vz-text-muted)] hover:text-primary transition-colors"
                      title="Edit role name"
                    >
                      <Pencil size={14} />
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => setConfirmDelete({ isOpen: true, role })}
                        className="p-1.5 rounded hover:bg-danger/10 text-danger hover:text-danger-dark transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {roles.length === 0 && (
          <div className="text-center py-12 text-[var(--vz-text-muted)]">
            No roles found. Create one to get started.
          </div>
        )}
      </div>

      {/* Edit Role Modal */}
      {showEdit && editRoleForm && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-[var(--vz-heading)]">Edit Role: {editRoleForm.name}</h3>
                    <button onClick={() => setShowEdit(false)} className="text-[var(--vz-text-muted)] hover:text-primary transition-colors">
                        <Pencil size={20} className="rotate-90" /> {/* Close icon substitution if X not imported */}
                    </button>
                </div>
                <form onSubmit={handleUpdate} className="space-y-4">
                    <Input label="Role Name" value={editRoleForm.name} onChange={(e) => setEditRoleForm({ ...editRoleForm, name: e.target.value })} />
                    <Input label="Description" value={editRoleForm.description} onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })} />
                    <div className="flex items-center justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={updating}>
                            {updating ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title={`Delete Role "${confirmDelete.role?.name}"?`}
        message="Users with this role will lose their permissions. This action cannot be undone."
        confirmText="Delete Role"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, role: null })}
      />
    </div>
  )
}
