import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Search, Filter, UserPlus, Building2, Trash2, Edit3, X, Users, Shield, Circle, Download, Calendar, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Mail, Phone } from 'lucide-react'
import { useListUsersQuery, useInviteUserMutation, useUpdateUserMutation, useDeleteUserMutation } from '../../features/users/userApi'
import { useGetCustomFieldsQuery } from '../../features/custom-fields/customFieldApi'
import { useListRolesCompactQuery } from '../../features/roles/roleApi'
import { useListBranchesQuery } from '../../features/branches/branchApi'
import { useSelector } from 'react-redux'
import Button from '../../components/ui/Button'

import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import DynamicCustomFieldInput from '../../components/ui/DynamicCustomFieldInput'
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
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--vz-border)]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-[var(--vz-border)]" />
          </div>
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-32 rounded bg-[var(--vz-border)]" />
          <div className="h-3 w-24 rounded bg-[var(--vz-border)]" />
        </div>
      </td>
      <td className="px-6 py-3"><div className="h-6 w-28 rounded-full bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-3"><div className="h-4 w-24 rounded bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-3"><div className="h-6 w-20 rounded-full bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-3"><div className="h-4 w-32 rounded bg-[var(--vz-border)]" /></td>
      <td className="px-6 py-3">
        <div className="flex justify-end gap-1.5">
          <div className="w-7 h-7 rounded bg-[var(--vz-border)]" />
          <div className="w-7 h-7 rounded bg-[var(--vz-border)]" />
          <div className="w-7 h-7 rounded bg-[var(--vz-border)]" />
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

  const { data: rolesResp } = useListRolesCompactQuery()
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
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', whatsappNumber: '', countryCode: '+91', roleId: '', branchId: '', password: '' })
  const [showEdit, setShowEdit] = useState(false)
  const [editUserForm, setEditUserForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, user: null })
  const { data: fieldsData } = useGetCustomFieldsQuery({ entity: 'User' }, { skip: !showInvite && !showEdit })
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
    const rId = typeof user.roleId === 'object' ? user.roleId?._id : user.roleId
    if (rId) navigate(`/admin/roles/${rId}`)
    else toast('This user has no role assigned', 'warning')
  }

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email) return toast('Name and email are required', 'warning')
    
    const userFields = fieldsData?.data || [];
    for (const field of userFields) {
      if (field.isRequired && (!inviteForm.customFields || !inviteForm.customFields[field.name])) {
        return toast(`${field.label || field.name} is required`, 'error')
      }
    }

    try {
      const payload = {
        contact: {
          name: inviteForm.name,
          email: inviteForm.email,
          phone: inviteForm.phone,
          whatsappNumber: inviteForm.whatsappNumber,
          countryCode: inviteForm.countryCode,
          password: inviteForm.password,
        },
        roleId: inviteForm.roleId,
        branchId: inviteForm.branchId,
        customFields: inviteForm.customFields || {},
      }
      await inviteUser(payload).unwrap()
      setShowInvite(false)
      setInviteForm({ name: '', email: '', phone: '', whatsappNumber: '', countryCode: '+91', roleId: '', branchId: '', password: '', customFields: {} })
    } catch (err) { toast(err.data?.message || 'Failed to invite user', 'error') }
  }

  const handleEdit = (user) => {
    setEditUserForm({
      id: user._id,
      name: user.contact?.name || '',
      email: user.contact?.email || '',
      phone: user.contact?.phone || '',
      whatsappNumber: user.contact?.whatsappNumber || '',
      countryCode: user.contact?.countryCode || '+91',
      role: user.role,
      roleId: typeof user.roleId === 'object' ? user.roleId?._id : user.roleId,
      branchId: typeof user.branchId === 'object' ? user.branchId?._id : user.branchId,
      isActive: user.isActive,
      avatar: user.contact?.avatar || '',
      password: '',
      customFields: user.customFields || {}
    })
    setShowEdit(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()

    const userFields = fieldsData?.data || [];
    for (const field of userFields) {
      if (field.isRequired && (!editUserForm.customFields || !editUserForm.customFields[field.name])) {
        return toast(`${field.label || field.name} is required`, 'error')
      }
    }

    try {
      const { id, name, email, phone, whatsappNumber, countryCode, avatar, password, role, roleId, branchId, isActive, customFields } = editUserForm
      const payload = {
        contact: {
          name,
          email,
          phone,
          whatsappNumber,
          countryCode,
          avatar,
          ...(password ? { password } : {}),
        },
        role,
        roleId,
        branchId,
        isActive,
        customFields: customFields || {},
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

  const getBranchName = (branch) => {
    if (!branch) return '—'
    if (typeof branch === 'object' && branch.name) return branch.name
    const id = typeof branch === 'object' ? branch._id : branch
    return branches.find(b => b._id === id)?.name || '—'
  }
  
  const getRoleName = (role) => {
    if (!role) return null
    if (typeof role === 'object' && role.name) return role.name
    const id = typeof role === 'object' ? role._id : role
    return roles.find(r => r._id === id)?.name || null
  }

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems)

  const hasActiveFilters = roleFilter || branchFilter || statusFilter !== ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--vz-heading)]">Users</h1>
          </div>
        </div>
        <Button onClick={() => setShowInvite(true)} variant="primary" size="md" className="shrink-0 rounded-lg shadow-sm font-medium px-4">
          <UserPlus size={16} /> Add User
        </Button>
      </div>

      {/* Main Card */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--vz-shadow)' }}>

        {/* Search Toolbar */}
        <div className="px-6 py-4 border-b border-[var(--vz-border)]">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-lg text-sm font-medium text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-colors"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto border-t border-[var(--vz-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--vz-border)] bg-gray-50/50 dark:bg-[var(--vz-body-bg)]/30">
                {['User', 'Contact', 'Role', 'Branch', 'Status', 'Last Login', 'Actions'].map((col) => (
                  <th
                    key={col}
                    className={`px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--vz-text-muted)] ${col === 'Actions' ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`flex items-center gap-1.5 ${col === 'Actions' ? 'justify-end' : ''}`}>
                      {col}
                      {col !== 'Actions' && (
                        <div className="flex flex-col text-[var(--vz-border)] hover:text-[var(--vz-text-muted)] cursor-pointer">
                          <ChevronUp size={8} className="translate-y-[2px]" />
                          <ChevronDown size={8} className="-translate-y-[2px]" />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => <UserRowSkeleton key={i} />)
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[var(--vz-text-muted)]">
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
                    <tr key={user._id} className="border-b border-[var(--vz-border)] last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-[var(--vz-body-bg)]/40 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#f3f0ff] dark:bg-purple-900/20 text-[#6d28d9] dark:text-purple-400 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 border border-[#e9d5ff] dark:border-purple-800">
                            {userAvatar ? (
                              <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                            ) : (
                              userName.charAt(0).toUpperCase() || '?'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[var(--vz-heading)] truncate leading-tight">{userName || 'Unnamed User'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col gap-1 justify-center min-w-[140px]">
                          {userEmail ? (
                            <div className="flex items-center gap-1.5 text-xs text-[var(--vz-text-muted)] group hover:text-primary transition-colors cursor-pointer">
                              <Mail size={12} className="shrink-0" />
                              <span className="truncate">{userEmail}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-[var(--vz-text-muted)] opacity-50">
                              <Mail size={12} className="shrink-0" />
                              <span>—</span>
                            </div>
                          )}
                          {user.contact?.phone ? (
                            <div className="flex items-center gap-1.5 text-xs text-[var(--vz-text-muted)] group hover:text-primary transition-colors cursor-pointer">
                              <Phone size={12} className="shrink-0" />
                              <span className="truncate">{user.contact.phone}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-[var(--vz-text-muted)] opacity-50">
                              <Phone size={12} className="shrink-0" />
                              <span>—</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-medium text-[var(--vz-text-muted)]">
                          {getRoleName(user.roleId) || user.role || 'No role'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--vz-text-muted)]">
                          <Building2 size={14} className="shrink-0" />
                          {getBranchName(user.branchId)}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${user.isActive
                          ? 'bg-green-50 text-green-600 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                          : 'bg-red-50 text-red-500 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-[var(--vz-text-muted)] font-medium whitespace-nowrap">
                        {formatLastLogin(userLastLogin)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1.5 text-[var(--vz-text-muted)] hover:text-primary hover:bg-primary/5 rounded transition-colors"
                            title="Edit User"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handlePermissions(user)}
                            className="p-1.5 text-[var(--vz-text-muted)] hover:text-primary hover:bg-primary/5 rounded transition-colors"
                            title="Role Permissions"
                          >
                            <UserPlus size={15} />
                          </button>
                          {user._id !== currentUser?._id && (
                            <button
                              onClick={() => setConfirmDelete({ isOpen: true, user })}
                              className="p-1.5 text-danger hover:text-danger-dark hover:bg-danger/10 rounded transition-colors"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-[var(--vz-border)] bg-white dark:bg-[var(--vz-card-bg)]">
            <p className="text-sm font-medium text-[var(--vz-text-muted)] w-full sm:w-1/3 text-left">
              Showing {startItem} to {endItem} of {totalItems} users
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
                {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map((p) => (
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
                  disabled={page === (totalPages || 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-[var(--vz-border)] text-[#3b548b] hover:border-[#3b548b] disabled:opacity-40 disabled:hover:border-[var(--vz-border)] disabled:text-[var(--vz-text-muted)] transition-colors shadow-sm bg-white dark:bg-transparent"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setPage(totalPages || 1)}
                  disabled={page === (totalPages || 1)}
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
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 text-[var(--vz-text-muted)] pointer-events-none" />
              </div>
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
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value.replace(/[^\d]/g, '') })}
                />
              </div>
            </div>
            <Input label="WhatsApp Number" type="tel" placeholder="e.g. +919876543210" value={inviteForm.whatsappNumber} onChange={(e) => setInviteForm({ ...inviteForm, whatsappNumber: e.target.value })} />
            <Input label="Set Password" type="password" placeholder="••••••••" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} />
          </div>

          {/* User Custom Fields */}
          {fieldsData?.data?.length > 0 && (
            <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
              <h6 className="text-[10px] font-bold text-[var(--vz-text-muted)] uppercase tracking-wider">Additional User Details</h6>
              <div className="grid grid-cols-2 gap-3">
                {fieldsData.data.map(field => (
                  <div key={field._id}>
                    <label className="block text-xs font-semibold text-[var(--vz-heading)] mb-1">{field.name}</label>
                    <DynamicCustomFieldInput
                      field={field}
                      value={inviteForm.customFields?.[field.name]}
                      onChange={(val) => setInviteForm({ ...inviteForm, customFields: { ...inviteForm.customFields, [field.name]: val } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  value={editUserForm.phone}
                  onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value.replace(/[^\d]/g, '') })}
                />
              </div>
            </div>
              <Input label="WhatsApp Number" type="tel" placeholder="e.g. +919876543210" value={editUserForm.whatsappNumber} onChange={(e) => setEditUserForm({ ...editUserForm, whatsappNumber: e.target.value })} />
              <Input label="Change Password?" type="password" placeholder="Leave blank to keep same" value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} />
            </div>

            {/* Dynamic User Fields */}
            {fieldsData?.data?.length > 0 && (
              <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
                <h6 className="text-[10px] font-bold text-[var(--vz-text-muted)] uppercase tracking-wider">Additional Information</h6>
                <div className="grid grid-cols-2 gap-3">
                  {fieldsData.data.map(field => (
                    <div key={field._id}>
                      <label className="block text-xs font-semibold text-[var(--vz-heading)] mb-1">{field.name}</label>
                      <DynamicCustomFieldInput
                        field={field}
                        value={editUserForm.customFields?.[field.name]}
                        onChange={(val) => setEditUserForm({ ...editUserForm, customFields: { ...editUserForm.customFields, [field.name]: val } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
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
