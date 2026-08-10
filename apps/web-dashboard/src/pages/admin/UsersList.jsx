import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Search, Filter, UserPlus, Building2, Trash2, Edit3, X } from 'lucide-react'
import { useListUsersQuery, useInviteUserMutation, useUpdateUserMutation, useDeleteUserMutation } from '../../features/users/userApi'
import { useListRolesQuery } from '../../features/roles/roleApi'
import { useListBranchesQuery } from '../../features/branches/branchApi'
import { useSelector } from 'react-redux'
import Button from '../../components/ui/Button'

import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'

const formatLastLogin = (dateStr) => {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const formatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${formatted}, ${time}`
}

function UserRowSkeleton() {
  return (
    <tr className="border-b border-[var(--vz-border)] animate-pulse">
      <td className="px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[var(--vz-border)]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-[var(--vz-border)]" />
            <div className="h-3 w-36 rounded bg-[var(--vz-border)]" />
          </div>
        </div>
      </td>
      <td className="px-6 py-2.5"><div className="h-6 w-28 rounded-full bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-2.5"><div className="h-3.5 w-24 rounded bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-2.5"><div className="h-6 w-16 rounded-full bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-2.5"><div className="h-3.5 w-32 rounded bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-2.5">
        <div className="flex justify-end gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--vz-border)]" />
          <div className="w-8 h-8 rounded-lg bg-[var(--vz-border)]" />
          <div className="w-8 h-8 rounded-lg bg-[var(--vz-border)]" />
        </div>
      </td>
    </tr>
  )
}

export default function UsersList() {
  const toast = useToast()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showFilters, setShowFilters] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

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
    limit: pageSize,
    search: debouncedSearch,
    matchedRoles: matchedRoles || undefined,
    ...(roleFilter && { roleId: roleFilter }),
    ...(statusFilter !== '' && { isActive: statusFilter }),
  })

  const { data: branchesResp } = useListBranchesQuery()
  const [inviteUser, { isLoading: inviting }] = useInviteUserMutation()
  const [updateUser, { isLoading: updatingUser }] = useUpdateUserMutation()
  const [deleteUser, { isLoading: deletingUser }] = useDeleteUserMutation()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', roleId: '', branchId: '', password: '' })
  const [showEdit, setShowEdit] = useState(false)
  const [editUserForm, setEditUserForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, user: null })
  const { user: currentUser } = useSelector((s) => s.auth)

  const users = usersResp?.data || []
  const usersPagination = usersResp?.pagination || {}
  const branches = branchesResp?.data || []

  const filteredUsers = branchFilter
    ? users.filter((u) => u.branchId === branchFilter)
    : users

  const totalItems = branchFilter ? filteredUsers.length : (usersPagination.total || filteredUsers.length)
  const totalPages = branchFilter
    ? Math.max(1, Math.ceil(filteredUsers.length / pageSize))
    : (usersPagination.totalPages || 1)

  const handlePermissions = (user) => {
    if (user.roleId) navigate(`/admin/roles/${user.roleId}`)
    else toast('This user has no role assigned', 'warning')
  }

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email) return toast('Name and email are required', 'warning')
    try {
      const payload = {
        contact: {
          name: inviteForm.name,
          email: inviteForm.email,
          phone: inviteForm.phone,
          password: inviteForm.password,
        },
        roleId: inviteForm.roleId,
        branchId: inviteForm.branchId,
      }
      await inviteUser(payload).unwrap()
      setShowInvite(false)
      setInviteForm({ name: '', email: '', phone: '', roleId: '', branchId: '', password: '' })
    } catch (err) { toast(err.data?.message || 'Failed to invite user', 'error') }
  }

  const handleEdit = (user) => {
    setEditUserForm({
      id: user._id,
      name: user.contact?.name || '',
      email: user.contact?.email || '',
      phone: user.contact?.phone || '',
      role: user.role,
      roleId: user.roleId,
      branchId: user.branchId,
      isActive: user.isActive,
      avatar: user.contact?.avatar || '',
      password: ''
    })
    setShowEdit(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const { id, name, email, phone, avatar, password, role, roleId, branchId, isActive } = editUserForm
      const payload = {
        contact: {
          name,
          email,
          phone,
          avatar,
          ...(password ? { password } : {}),
        },
        role,
        roleId,
        branchId,
        isActive,
      }
      await updateUser({ id, ...payload }).unwrap()
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

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems)

  const clearFilters = () => {
    setRoleFilter('')
    setBranchFilter('')
    setStatusFilter('')
    setPage(1)
  }

  const hasActiveFilters = roleFilter || branchFilter || statusFilter !== ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--vz-heading)]">Users</h1>
        </div>
        <Button onClick={() => setShowInvite(true)} variant="primary" size="md" className="shrink-0 rounded-lg">
          <UserPlus size={16} /> Add User
        </Button>
      </div>

      {/* Main Card */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--vz-shadow)' }}>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-[var(--vz-border)]">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-lg text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors shrink-0
                ${showFilters || hasActiveFilters
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-[var(--vz-border)] text-[var(--vz-heading)] hover:bg-[var(--vz-input-bg)]'
                }`}
            >
              <Filter size={15} />
              Filter
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          </div>
          <span className="text-sm text-[var(--vz-text-muted)] shrink-0">
            Total {usersPagination.total || filteredUsers.length} users
          </span>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="px-6 py-4 border-b border-[var(--vz-border)] bg-[var(--vz-body-bg)]/40">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-44">
                <label className="block text-xs font-medium text-[var(--vz-text-muted)] mb-1.5">Role</label>
                <Select
                  value={roleFilter}
                  onChange={(val) => { setRoleFilter(val); setPage(1) }}
                  options={[
                    { value: '', label: 'All Roles' },
                    ...roles.map(r => ({ value: r._id, label: r.name })),
                  ]}
                />
              </div>
              <div className="w-44">
                <label className="block text-xs font-medium text-[var(--vz-text-muted)] mb-1.5">Branch</label>
                <Select
                  value={branchFilter}
                  onChange={(val) => { setBranchFilter(val); setPage(1) }}
                  options={[
                    { value: '', label: 'All Branches' },
                    ...branches.map(b => ({ value: b._id, label: b.name })),
                  ]}
                />
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-[var(--vz-text-muted)] mb-1.5">Status</label>
                <Select
                  value={statusFilter}
                  onChange={(val) => { setStatusFilter(val); setPage(1) }}
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Inactive' },
                  ]}
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors pb-2"
                >
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--vz-border)] bg-[var(--vz-body-bg)]/30">
                {['User', 'Role', 'Branch', 'Status', 'Last Login', 'Actions'].map((col) => (
                  <th
                    key={col}
                    className={`px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)] ${col === 'Actions' ? 'text-right' : 'text-left'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => <UserRowSkeleton key={i} />)
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[var(--vz-text-muted)]">
                    {search || hasActiveFilters ? 'No users match your search or filters.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const userName = user.contact?.name || ''
                  const userEmail = user.contact?.email || ''
                  const userAvatar = user.contact?.avatar
                  const userLastLogin = user.authentication?.lastLoginAt

                  return (
                    <tr key={user._id} className="border-b border-[var(--vz-border)] last:border-b-0 hover:bg-[var(--vz-body-bg)]/40 transition-colors">
                      <td className="px-6 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)] flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0 border border-[var(--vz-border)]">
                            {userAvatar ? (
                              <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                            ) : (
                              userName.charAt(0).toUpperCase() || '?'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--vz-heading)] truncate leading-tight">{userName || 'Unnamed User'}</div>
                            <div className="text-xs text-[var(--vz-text-muted)] truncate leading-tight">{userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          <User size={13} />
                          {getRoleName(user.roleId) || user.role || 'No role'}
                        </span>
                      </td>
                      <td className="px-6 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--vz-text)]">
                          <Building2 size={14} className="text-[var(--vz-text-muted)] shrink-0" />
                          {getBranchName(user.branchId)}
                        </span>
                      </td>
                      <td className="px-6 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          user.isActive
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-sm text-[var(--vz-text-muted)] whitespace-nowrap">
                        {formatLastLogin(userLastLogin)}
                      </td>
                      <td className="px-6 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="w-8 h-8 rounded-lg border border-[var(--vz-border)] flex items-center justify-center text-[var(--vz-text-muted)] hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
                            title="Edit User"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handlePermissions(user)}
                            className="w-8 h-8 rounded-lg border border-[var(--vz-border)] flex items-center justify-center text-[var(--vz-text-muted)] hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
                            title="Role Permissions"
                          >
                            <UserPlus size={15} />
                          </button>
                          {user._id !== currentUser?._id && (
                            <button
                              onClick={() => setConfirmDelete({ isOpen: true, user })}
                              className="w-8 h-8 rounded-lg border border-red-200 dark:border-red-900/40 flex items-center justify-center text-[var(--vz-danger)] hover:bg-red-500/10 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-[var(--vz-border)]">
            <p className="text-sm text-[var(--vz-text-muted)]">
              Showing {startItem} to {endItem} of {totalItems} users
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-[var(--vz-text-muted)] hover:bg-[var(--vz-input-bg)] disabled:opacity-40 transition-colors"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                      page === p
                        ? 'bg-primary text-white'
                        : 'text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg text-[var(--vz-text-muted)] hover:bg-[var(--vz-input-bg)] disabled:opacity-40 transition-colors"
                >
                  ›
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="text-sm bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-lg px-3 py-2 text-[var(--vz-heading)] focus:outline-none focus:border-primary cursor-pointer"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            </div>
          </div>
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
        title={`Remove User "${confirmDelete.user?.contact?.name || confirmDelete.user?.name || 'this user'}"?`}
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
