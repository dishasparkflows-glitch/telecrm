import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft, Save, Loader2, Check, X, Eye, Globe, Building2 } from 'lucide-react'
import {
  useGetRoleQuery, useGetAvailableModulesQuery,
  useUpdateRolePermissionsMutation,
} from '../../features/roles/roleApi'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'upload', 'import']

export default function RolePermissions() {
  const toast = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: roleResp, isLoading: loadingRole } = useGetRoleQuery(id)
  const { data: modulesResp } = useGetAvailableModulesQuery()
  const [updatePermissions, { isLoading: saving }] = useUpdateRolePermissionsMutation()

  const [permMatrix, setPermMatrix] = useState({})
  const [saved, setSaved] = useState(false)

  const role = roleResp?.data
  const moduleKeys = useMemo(() => modulesResp?.data || [], [modulesResp?.data])

  // Initialize matrix from role permissions
  useEffect(() => {
    if (!role) return
    const map = {}
    for (const perm of role.permissions || []) {
      map[perm.moduleKey] = { ...perm.actions }
    }
    // Ensure all module keys exist in matrix
    for (const key of moduleKeys) {
      if (!map[key]) {
        map[key] = { view: false, create: false, edit: false, delete: false, export: false, upload: false, isOwn: true, isGlobal: false }
      } else {
        // Ensure isOwn/isBranch/isGlobal exist with defaults
        if (map[key].isOwn === undefined) map[key].isOwn = true
        if (map[key].isBranch === undefined) map[key].isBranch = false
        if (map[key].isGlobal === undefined) map[key].isGlobal = false
      }
    }
    setPermMatrix(map)
  }, [role, moduleKeys])

  const togglePerm = (moduleKey, action) => {
    setPermMatrix((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [action]: !prev[moduleKey]?.[action],
      },
    }))
    setSaved(false)
  }

  // Toggle visibility: isOwn, isBranch, and isGlobal are mutually exclusive
  const toggleVisibility = (moduleKey, field) => {
    setPermMatrix((prev) => {
      const current = prev[moduleKey] || {}
      return {
        ...prev,
        [moduleKey]: {
          ...current,
          isOwn: field === 'isOwn' ? true : false,
          isBranch: field === 'isBranch' ? true : false,
          isGlobal: field === 'isGlobal' ? true : false,
        }
      }
    })
    setSaved(false)
  }

  const toggleAllForModule = (moduleKey) => {
    const current = permMatrix[moduleKey] || {}
    const allOn = ACTIONS.every((a) => current[a])
    const newActions = { isOwn: current.isOwn, isBranch: current.isBranch, isGlobal: current.isGlobal }
    ACTIONS.forEach((a) => (newActions[a] = !allOn))
    setPermMatrix((prev) => ({ ...prev, [moduleKey]: newActions }))
    setSaved(false)
  }

  const toggleAllForAction = (action) => {
    const allOn = moduleKeys.every((k) => permMatrix[k]?.[action])
    setPermMatrix((prev) => {
      const updated = { ...prev }
      for (const key of moduleKeys) {
        updated[key] = { ...(updated[key] || {}), [action]: !allOn }
      }
      return updated
    })
    setSaved(false)
  }

  const handleSave = async () => {
    const permissions = Object.entries(permMatrix).map(([moduleKey, actions]) => ({
      moduleKey,
      actions,
    }))
    try {
      await updatePermissions({ id, permissions }).unwrap()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast(err.data?.message || 'Failed to save permissions', 'error')
    }
  }

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  if (!role) {
    return (
      <div className="text-center py-12 text-[var(--vz-text-muted)]">Role not found</div>
    )
  }

  const isSuperAdminRole = role.slug === 'super-admin' && role.isSystem

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/roles')}
            className="p-2 rounded-lg hover:bg-[var(--vz-body-bg)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-[var(--vz-heading)] flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              {role.name} — Permissions
            </h1>
            <p className="text-sm text-[var(--vz-text-muted)] mt-0.5">{role.description || 'Configure module access'}</p>
          </div>
        </div>
        {!isSuperAdminRole && (
          <Button onClick={handleSave} variant="primary" size="sm" disabled={saving || saved}>
            {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Saving...</>
              : saved ? <><Check size={14} className="mr-1" /> Saved!</>
              : <><Save size={14} className="mr-1" /> Save Permissions</>
            }
          </Button>
        )}
      </div>

      {isSuperAdminRole && (
        <div className="p-4 rounded-lg bg-blue-500/10 text-blue-400 text-sm">
          <Shield className="inline mr-2" size={16} />
          Super Admin has full access to all modules. Permissions cannot be modified.
        </div>
      )}

      {/* Visibility Legend */}
      {!isSuperAdminRole && (
        <div className="flex items-center gap-6 p-3 rounded-lg bg-[var(--vz-body-bg)] border border-[var(--vz-border)] text-xs text-[var(--vz-text-muted)]">
          <span className="font-semibold text-[var(--vz-heading)]">Data Visibility:</span>
          <span className="flex items-center gap-1.5">
            <Globe size={13} className="text-emerald-500" />
            <strong>All Data</strong> — User sees all records in the tenant
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 size={13} className="text-blue-500" />
            <strong>Branch Data</strong> — User sees all records in their branch
          </span>
          <span className="flex items-center gap-1.5">
            <Eye size={13} className="text-amber-500" />
            <strong>Own Data Only</strong> — User sees only records they created/own
          </span>
        </div>
      )}

      {/* Permission Matrix */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg overflow-x-auto" style={{ boxShadow: 'var(--vz-shadow)' }}>
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--vz-border)]">
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)] w-[160px]">Module</th>
              {ACTIONS.map((action) => (
                <th key={action} className="text-center px-2 py-3 w-[75px]">
                  <button
                    onClick={() => !isSuperAdminRole && toggleAllForAction(action)}
                    className="text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)] hover:text-primary transition-colors"
                    disabled={isSuperAdminRole}
                  >
                    {action}
                  </button>
                </th>
              ))}
              <th className="text-center px-2 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--vz-text-muted)] w-[60px]">All</th>
              {/* Visibility columns */}
              <th className="text-center px-2 py-3 w-[1px] bg-[var(--vz-border)]"></th>
              <th className="text-center px-3 py-3 w-[100px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500 flex items-center justify-center gap-1">
                  <Globe size={12} /> All Data
                </span>
              </th>
              <th className="text-center px-3 py-3 w-[100px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500 flex items-center justify-center gap-1">
                  <Building2 size={12} /> Branch Data
                </span>
              </th>
              <th className="text-center px-3 py-3 w-[100px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 flex items-center justify-center gap-1">
                  <Eye size={12} /> Own Only
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vz-border)]">
            {moduleKeys.map((moduleKey) => {
              const perms = permMatrix[moduleKey] || {}
              const allOn = ACTIONS.every((a) => perms[a])
              const isAdminModule = ['roles', 'modules', 'branches', 'users', 'settings', 'billing', 'audit'].includes(moduleKey)

              return (
                <tr key={moduleKey} className="hover:bg-[var(--vz-body-bg)]/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-medium text-[var(--vz-heading)] capitalize">{moduleKey.replace(/_/g, ' ')}</span>
                  </td>
                  {ACTIONS.map((action) => (
                    <td key={action} className="text-center px-2 py-3">
                      <button
                        onClick={() => !isSuperAdminRole && togglePerm(moduleKey, action)}
                        disabled={isSuperAdminRole}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all duration-200
                          ${(isSuperAdminRole || perms[action])
                            ? 'bg-primary text-white shadow-sm shadow-primary/30'
                            : 'bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)] hover:bg-[var(--vz-border)]'
                          }
                          ${isSuperAdminRole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                        `}
                      >
                        {(isSuperAdminRole || perms[action]) ? <Check size={12} /> : <X size={12} />}
                      </button>
                    </td>
                  ))}
                  <td className="text-center px-2 py-3">
                    <button
                      onClick={() => !isSuperAdminRole && toggleAllForModule(moduleKey)}
                      disabled={isSuperAdminRole}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors
                        ${allOn || isSuperAdminRole
                          ? 'bg-primary/10 text-primary'
                          : 'bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)] hover:text-primary'
                        }
                        ${isSuperAdminRole ? 'cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      {allOn || isSuperAdminRole ? 'All' : 'None'}
                    </button>
                  </td>
                  {/* Separator */}
                  <td className="w-[1px] bg-[var(--vz-border)]"></td>
                  {/* isGlobal — All Tenant Data */}
                  <td className="text-center px-3 py-3">
                    {isAdminModule ? (
                      <span className="text-[10px] text-[var(--vz-text-muted)]">—</span>
                    ) : (
                      <button
                        onClick={() => !isSuperAdminRole && toggleVisibility(moduleKey, 'isGlobal')}
                        disabled={isSuperAdminRole}
                        className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-all duration-200
                          ${(isSuperAdminRole || perms.isGlobal)
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                            : 'bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)] hover:bg-[var(--vz-border)] border border-[var(--vz-border)]'
                          }
                          ${isSuperAdminRole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                        `}
                      >
                        {(isSuperAdminRole || perms.isGlobal) && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </button>
                    )}
                  </td>
                  {/* isBranch — Branch Data */}
                  <td className="text-center px-3 py-3">
                    {isAdminModule ? (
                      <span className="text-[10px] text-[var(--vz-text-muted)]">—</span>
                    ) : (
                      <button
                        onClick={() => !isSuperAdminRole && toggleVisibility(moduleKey, 'isBranch')}
                        disabled={isSuperAdminRole}
                        className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-all duration-200
                          ${(perms.isBranch)
                            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                            : 'bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)] hover:bg-[var(--vz-border)] border border-[var(--vz-border)]'
                          }
                          ${isSuperAdminRole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                        `}
                      >
                        {perms.isBranch && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </button>
                    )}
                  </td>
                  {/* isOwn — Own Data Only */}
                  <td className="text-center px-3 py-3">
                    {isAdminModule ? (
                      <span className="text-[10px] text-[var(--vz-text-muted)]">—</span>
                    ) : (
                      <button
                        onClick={() => !isSuperAdminRole && toggleVisibility(moduleKey, 'isOwn')}
                        disabled={isSuperAdminRole}
                        className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-all duration-200
                          ${perms.isOwn
                            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                            : 'bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)] hover:bg-[var(--vz-border)] border border-[var(--vz-border)]'
                          }
                          ${isSuperAdminRole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                        `}
                      >
                        {perms.isOwn && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
