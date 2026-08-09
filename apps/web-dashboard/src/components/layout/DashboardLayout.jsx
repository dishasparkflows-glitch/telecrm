import { useSelector, useDispatch } from 'react-redux'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Dialer from '../communication/Dialer'
import { useAuth } from '../../hooks/useAuth'
import { logout } from '../../slices/authSlice'
import { Shield, X } from 'lucide-react'

export default function DashboardLayout() {
  const { sidebarCollapsed } = useSelector((s) => s.ui)
  const dispatch = useDispatch()
  // Triggers /auth/me fetch on mount if token exists but user is null (e.g. page refresh)
  useAuth()
  const contentMargin = sidebarCollapsed ? 'md:ml-[70px]' : 'md:ml-[250px]'

  // Check if owner is impersonating a tenant
  const impersonating = localStorage.getItem('sparkcrm_impersonating')
  const impTenant = impersonating ? JSON.parse(impersonating) : null

  const exitImpersonation = () => {
    const ownerToken = localStorage.getItem('sparkcrm_owner_token')
    if (ownerToken) {
      // Clear impersonation state
      localStorage.removeItem('sparkcrm_impersonating')

      // Restore owner token and user
      localStorage.setItem('sparkcrm_token', ownerToken)
      const ownerUser = localStorage.getItem('sparkcrm_owner_user')
      if (ownerUser && ownerUser !== 'null' && ownerUser !== 'undefined') {
        localStorage.setItem('sparkcrm_user', ownerUser)
      } else {
        // If owner user wasn't saved, create a minimal owner user object
        // so OwnerRoute recognizes the role and doesn't redirect to /dashboard
        localStorage.setItem('sparkcrm_user', JSON.stringify({ role: 'owner' }))
      }
      localStorage.removeItem('sparkcrm_owner_token')
      localStorage.removeItem('sparkcrm_owner_user')
      localStorage.removeItem('sparkcrm_permissions')
      localStorage.removeItem('sparkcrm_modules')
      localStorage.removeItem('sparkcrm_branches')
      localStorage.removeItem('sparkcrm_active_branch')

      // Full page reload for clean state
      window.location.href = '/owner'
    } else {
      // Fallback: logout and redirect
      dispatch(logout())
      window.location.href = '/owner/login'
    }
  }

  return (
    <div className="min-h-screen bg-[var(--vz-body-bg)] transition-colors duration-200">
      {/* Impersonation Banner */}
      {impTenant && (
        <div
          className={`fixed top-0 left-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg transition-all duration-300 w-full h-[70px] ${sidebarCollapsed ? 'md:w-[70px]' : 'md:w-[250px]'}`}
        >
          <Shield size={14} className="shrink-0" />
          <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>
            👑 <strong>{impTenant.company?.name}</strong>
          </span>
          <button
            onClick={exitImpersonation}
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold ${sidebarCollapsed ? 'md:hidden' : ''}`}
          >
            <X size={14} /> Exit
          </button>
        </div>
      )}

      <Sidebar />
      <Topbar />
      <main className={`${impTenant ? 'pt-[106px]' : 'pt-[70px]'} ${contentMargin} transition-all duration-300`}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <Dialer />
    </div>
  )
}
