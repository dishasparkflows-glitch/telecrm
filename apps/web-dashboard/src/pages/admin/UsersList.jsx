import { useState, useEffect } from 'react'
import { UserCog, Search, Shield, Loader2, ChevronDown, UserPlus, Building2, Trash2, Edit3, X, UserCheck, UserX } from 'lucide-react'
import { useListUsersQuery, useUpdateUserRoleMutation, useUpdateUserStatusMutation, useInviteUserMutation, useUpdateUserMutation, useDeleteUserMutation } from '../../features/users/userApi'
import { useListRolesQuery } from '../../features/roles/roleApi'
import { useListBranchesQuery } from '../../features/branches/branchApi'
import { useSelector } from 'react-redux'
import Button from '../../components/ui/Button'

import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
import { useToast } from '../../components/ui/Toast'

export default function UsersList() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const { data: rolesResp } = useListRolesQuery()
  const roles = rolesResp?.data || []
  
  // Find roles that match the search term
  const matchedRoles = debouncedSearch 
    ? roles.filter(r => r.name.toLowerCase().includes(debouncedSearch.toLowerCase())).map(r => r._id).join(',')
    : ''

  const { data: usersResp, isLoading } = useListUsersQuery({ 
    page, 
    limit: PAGE_SIZE, 
    search: debouncedSearch,
    matchedRoles: matchedRoles || undefined
  })
  
  const { data: branchesResp } = useListBranchesQuery()
  const [updateRole] = useUpdateUserRoleMutation()
  const [updateStatus] = useUpdateUserStatusMutation()
  const [inviteUser, { isLoading: inviting }] = useInviteUserMutation()
  const [updateUser, { isLoading: updatingUser }] = useUpdateUserMutation()
  const [deleteUser, { isLoading: deletingUser }] = useDeleteUserMutation()
  const [roleChanging, setRoleChanging] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', roleId: '', branchId: '', password: '' })
  const [showEdit, setShowEdit] = useState(false)
  const [editUserForm, setEditUserForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, user: null })
  const { user: currentUser } = useSelector((s) => s.auth)

  const users = usersResp?.data || []
  const usersPagination = usersResp?.pagination || {}
  const branches = branchesResp?.data || []

  const filteredUsers = users

  const handleRoleChange = async (userId, roleId) => {
    try {
      await updateRole({ id: userId, roleId }).unwrap()
      setRoleChanging(null)
    } catch (err) { toast(err.data?.message || 'Failed to update role', 'error') }
  }

  const handleStatusToggle = async (userId, currentStatus) => {
    try { await updateStatus({ id: userId, isActive: !currentStatus }).unwrap() }
    catch (err) { toast(err.data?.message || 'Failed to update status', 'error') }
  }

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email) return toast('Name and email are required', 'warning')
    try {
      await inviteUser(inviteForm).unwrap()
      setShowInvite(false)
      setInviteForm({ name: '', email: '', phone: '', roleId: '', branchId: '', password: '' })
    } catch (err) { toast(err.data?.message || 'Failed to invite user', 'error') }
  }

  const handleEdit = (user) => {
    setEditUserForm({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        roleId: user.roleId,
        branchId: user.branchId,
        isActive: user.isActive,
        avatar: user.avatar,
        password: ''
    })
    setShowEdit(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
        const { id, ...data } = editUserForm
        if (!data.password) delete data.password
        await updateUser({ id, ...data }).unwrap()
        setShowEdit(false)
    } catch (err) { toast(err.data?.message || 'Failed to update user', 'error') }
  }

  const handleDelete = async () => {
    if (!confirmDelete.user) return
    try { 
      await deleteUser(confirmDelete.user._id).unwrap() 
      setConfirmDelete({ isOpen: false, user: null })
    }
    catch (err) { toast(err.data?.message || 'Failed to remove user', 'error') }
  }

  const getBranchName = (branchId) => branches.find(b => b._id === branchId)?.name || '—'
  const getRoleName = (roleId) => roles.find(r => r._id === roleId)?.name || null

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
            <UserCog size={22} className="text-primary" />
            Users
          </h1>
          <p className="text-sm text-[var(--vz-text-muted)] mt-1">
            Manage users, assign roles and branches, and control access
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)} variant="primary" size="sm">
          <UserPlus size={16} className="mr-1" /> Add User
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
          <input type="text" placeholder="Search users by name, email, or role..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-lg text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] focus:outline-none focus:border-primary"
          />
        </div>
        <span className="text-sm text-[var(--vz-text-muted)]">{filteredUsers.length} users</span>
      </div>

      {/* Users Table */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg overflow-hidden" style={{ boxShadow: 'var(--vz-shadow)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--vz-border)]">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">User</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Role</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Branch</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Status</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Last Login</th>
              <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vz-border)]">
            {filteredUsers.map((user) => (
              <tr key={user._id} className="hover:bg-[var(--vz-body-bg)]/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--vz-heading)]">{user.name}</div>
                      <div className="text-xs text-[var(--vz-text-muted)]">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  {roleChanging === user._id ? (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setRoleChanging(null)} />
                      <div className="w-40 relative z-50" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={user.roleId || ''}
                          onChange={(val) => handleRoleChange(user._id, val)}
                          options={roles.map(r => ({ value: r._id, label: r.name }))}
                        />
                      </div>
                    </>
                  ) : (
                    <button onClick={() => setRoleChanging(user._id)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors">
                      <Shield size={12} />
                      {getRoleName(user.roleId) || user.role || 'No role'}
                      <ChevronDown size={10} />
                    </button>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--vz-text)]">
                    <Building2 size={12} className="text-[var(--vz-text-muted)]" />
                    {getBranchName(user.branchId)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    user.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-4 text-[var(--vz-text-muted)] text-xs">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEdit(user)} className="p-1.5 rounded text-[var(--vz-primary)] hover:bg-[var(--vz-primary)]/10 transition-colors" title="Edit User">
                        <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleStatusToggle(user._id, user.isActive)} 
                      className={`p-1.5 rounded transition-colors ${
                        user.isActive 
                          ? 'text-[var(--vz-warning)] hover:bg-[var(--vz-warning)]/10' 
                          : 'text-[var(--vz-success)] hover:bg-[var(--vz-success)]/10'
                      }`}
                      title={user.isActive ? 'Suspend User' : 'Activate User'}
                    >
                      {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    {user._id !== currentUser?._id && (
                      <button 
                        onClick={() => setConfirmDelete({ isOpen: true, user })} 
                        className="p-1.5 rounded text-[var(--vz-danger)] hover:bg-[var(--vz-danger)]/10 transition-colors" 
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-[var(--vz-text-muted)]">
            {search ? 'No users match your search.' : 'No users found.'}
          </div>
        )}

        {usersPagination.totalPages > 1 && (
          <Pagination currentPage={page} totalPages={usersPagination.totalPages || 1} totalItems={usersPagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>

      {/* Invite User Modal */}
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Add User" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name" placeholder="John Doe" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
            <Input label="Email" type="email" placeholder="john@company.com" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Role</label>
              <Select
                value={inviteForm.roleId || ''}
                onChange={(val) => setInviteForm({ ...inviteForm, roleId: val })}
                options={[
                  { value: '', label: 'Select Role' },
                  ...roles.map(r => ({ value: r._id, label: r.name }))
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Branch</label>
              <Select
                value={inviteForm.branchId || ''}
                onChange={(val) => setInviteForm({ ...inviteForm, branchId: val })}
                options={[
                  { value: '', label: 'Select Branch' },
                  ...branches.map(b => ({ value: b._id, label: b.name }))
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" type="tel" placeholder="+91 98765 43210" value={inviteForm.phone} onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value.replace(/[^\d\+\-\(\)\s]/g, '') })} />
            <Input label="Set Password" type="password" placeholder="••••••••" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} />
          </div>
          <p className="text-xs text-[var(--vz-text-muted)] italic">
            Note: An invitation email will be sent. If you specify a password, the user can log in immediately. Otherwise, a random temporary password will be generated.
          </p>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowInvite(false)}>Cancel</Button>
          <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteForm.name || !inviteForm.email}>
            {inviting ? 'Creating...' : 'Create User'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit User" size="md">
        {editUserForm && (
          <form onSubmit={handleUpdate} className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 bg-[var(--vz-body-bg)] rounded-lg border border-[var(--vz-border)]">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold overflow-hidden shrink-0 border border-primary/20">
                {editUserForm.avatar ? (
                  <img src={editUserForm.avatar} alt={editUserForm.name} className="w-full h-full object-cover" />
                ) : (
                  editUserForm.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-[var(--vz-heading)] text-sm truncate">{editUserForm.name}</h4>
                <p className="text-xs text-[var(--vz-text-muted)] truncate">{editUserForm.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <Input label="Full Name" placeholder="John Doe" value={editUserForm.name} onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })} />
               <Input label="Email Address" type="email" readOnly value={editUserForm.email} className="bg-[var(--vz-body-bg)]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                 <label className="block text-sm font-medium text-[var(--vz-heading)]">Role</label>
                 <Select
                   value={editUserForm.roleId || ''}
                   onChange={(val) => setEditUserForm({ ...editUserForm, roleId: val })}
                   options={[
                     { value: '', label: 'Select Role' },
                     ...roles.map(r => ({ value: r._id, label: r.name }))
                   ]}
                 />
               </div>
               <div className="space-y-1.5">
                 <label className="block text-sm font-medium text-[var(--vz-heading)]">Primary Branch</label>
                 <Select
                   value={editUserForm.branchId || ''}
                   onChange={(val) => setEditUserForm({ ...editUserForm, branchId: val })}
                   options={[
                     { value: '', label: 'Select Branch' },
                     ...branches.map(b => ({ value: b._id, label: b.name }))
                   ]}
                 />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <Input label="Phone" placeholder="+91 ..." value={editUserForm.phone} onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value.replace(/[^\d\+\-\(\)\s]/g, '') })} />
               <Input label="Change Password?" type="password" placeholder="Leave blank to keep same" value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="user_active_list" checked={editUserForm.isActive} onChange={(e) => setEditUserForm({ ...editUserForm, isActive: e.target.checked })} />
                <label htmlFor="user_active_list" className="text-sm font-medium text-[var(--vz-heading)]">Account Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={updatingUser}>
                    {updatingUser ? 'Updating...' : 'Save Changes'}
                </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title={`Remove User "${confirmDelete.user?.name}"?`}
        message="This user will lose access to the CRM. This action cannot be undone."
        confirmText="Remove User"
        variant="danger"
        loading={deletingUser}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, user: null })}
      />
    </div>
  )
}
