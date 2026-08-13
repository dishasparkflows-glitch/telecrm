import { useSelector, useDispatch } from 'react-redux'
import { toggleSidebar, toggleMobileSidebar, toggleTheme, openDialer } from '../../slices/uiSlice'
import { logout, setActiveBranch } from '../../slices/authSlice'
import { useLogoutMutation, useSwitchBranchMutation } from '../../features/auth/authApi'
import { baseApi } from '../../features/api/baseApi'
import { useToast } from '../../components/ui/Toast'
import { ROLES } from '../../utils/constants'
import { useGetNotificationsQuery, useMarkAsReadMutation } from '../../features/notifications/notificationApi'
import { useListBranchesQuery } from '../../features/branches/branchApi'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Search, Sun, Moon, Bell, Maximize, ChevronDown, LogOut, User, Settings, Building2, Phone } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNotificationsSocket } from '../../hooks/useNotificationsSocket'

export default function Topbar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  useNotificationsSocket() // Initialize real-time notifications
  const { theme, sidebarCollapsed } = useSelector((s) => s.ui)
  const { user, activeBranchId } = useSelector((s) => s.auth)
  const { data: branchesData } = useListBranchesQuery(undefined, { skip: user?.role !== ROLES.SUPER_ADMIN })
  const [logoutApi] = useLogoutMutation()
  const [switchBranchApi] = useSwitchBranchMutation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)
  const userMenuRef = useRef(null)
  const notifRef = useRef(null)
  const branchRef = useRef(null)

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN
  const isImpersonating = user?.isImpersonating === true
  const branches = branchesData?.data || []
  const activeBranch = branches.find(b => b._id === activeBranchId)

  // Listen for real-time notification events to show a toast
  useEffect(() => {
    const handleNewNotification = (e) => {
      const { title, message, type } = e.detail
      toast(title || message, type === 'error' ? 'error' : 'success')
    }
    window.addEventListener('app:notification', handleNewNotification)
    return () => window.removeEventListener('app:notification', handleNewNotification)
  }, [toast])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (branchRef.current && !branchRef.current.contains(e.target)) setBranchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    try { await logoutApi().unwrap() } catch { /* Local logout must still complete if server logout is unavailable. */ }
    dispatch(logout())
    navigate('/login')
  }

  return (
    <header
      className={`fixed top-0 right-0 z-30 flex items-center justify-between h-[70px] px-6
        bg-[var(--vz-topbar-bg)] border-b border-[var(--vz-border)] transition-all duration-300
        left-0 ${sidebarCollapsed ? 'md:left-[70px]' : 'md:left-[250px]'}`}
      style={{ boxShadow: 'var(--vz-shadow)' }}
    >
      {/* Left: Hamburger + Search */}
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-[var(--vz-topbar-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
          onClick={() => dispatch(toggleMobileSidebar())}
        >
          <Menu size={20} />
        </button>

        {/* Desktop collapse */}
        <button
          className="hidden md:flex p-2 rounded-lg text-[var(--vz-topbar-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
          onClick={() => dispatch(toggleSidebar())}
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-[var(--vz-input-bg)] rounded-lg px-3 py-2 w-[240px]">
          <input
            type="search"
            name="topbar_search_query"
            autoComplete="new-password"
            placeholder="Search..."
            className="bg-transparent outline-none text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] w-full"
          />
        </div>
      </div>

      {/* Right: Branch Selector, Theme, Fullscreen, Notifications, User */}
      <div className="flex items-center gap-1">

        {/* Branch Selector — Super Admin only */}
        {isSuperAdmin && branches?.length > 0 && (
          <div className="relative" ref={branchRef}>
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                bg-[var(--vz-input-bg)] text-[var(--vz-heading)] hover:bg-[var(--vz-input-bg)]
                border border-[var(--vz-border)] transition-colors mr-2"
            >
              <Building2 size={16} className="text-primary" />
              <span className="hidden sm:inline max-w-[120px] truncate">
                {activeBranch?.name || 'All Branches'}
              </span>
              <ChevronDown size={14} className="text-[var(--vz-text-muted)]" />
            </button>

            {branchOpen && (
              <div className="absolute left-0 top-11 w-[220px] bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg shadow-lg overflow-hidden z-50">
                <div className="px-4 py-2.5 border-b border-[var(--vz-border)]">
                  <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase tracking-wide">
                    Switch Branch
                  </p>
                </div>
                <div className="max-h-[200px] overflow-y-auto py-1">
                  {branches.map((branch) => (
                    <button
                      key={branch._id}
                      onClick={async () => {
                        try {
                          // During impersonation, skip API call — owner isn't in User collection
                          if (!isImpersonating) {
                            await switchBranchApi(branch._id).unwrap()
                          }
                          dispatch(setActiveBranch(branch._id))
                          dispatch(baseApi.util.resetApiState())
                          setBranchOpen(false)
                          toast('Branch switched successfully', 'success')
                        } catch (err) {
                           toast(err.data?.message || 'Failed to switch branch', 'error')
                        }
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors
                        ${activeBranchId === branch._id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)]'}`}
                    >
                      <Building2 size={14} />
                      <span className="truncate">{branch.name}</span>
                      {branch.isDefault && (
                        <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => dispatch(toggleTheme())}
          className="p-2.5 rounded-lg text-[var(--vz-topbar-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Fullscreen */}
        <button
          onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}
          className="hidden sm:flex p-2.5 rounded-lg text-[var(--vz-topbar-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
        >
          <Maximize size={20} />
        </button>
        
        {/* Dialer Button */}
        {location.pathname.startsWith('/leads') && (
          <button
            onClick={() => dispatch(openDialer())}
            className="p-2.5 rounded-lg text-[var(--vz-topbar-text)] hover:bg-[var(--vz-input-bg)] transition-colors text-primary"
            title="Open Dialer"
          >
            <Phone size={20} />
          </button>
        )}

        {/* Notifications */}
        <NotificationBell notifRef={notifRef} notifOpen={notifOpen} setNotifOpen={setNotifOpen} navigate={navigate} />

        {/* User Menu */}
        <div className="relative ml-2" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--vz-input-bg)] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-semibold overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0] || 'A'
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-[var(--vz-heading)] leading-tight">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[11px] text-[var(--vz-text-muted)] leading-tight">
                {user?.role || 'Founder'}
              </p>
            </div>
            <ChevronDown size={14} className="text-[var(--vz-text-muted)] hidden sm:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-12 w-[180px] bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--vz-border)]">
                <p className="text-sm font-semibold text-[var(--vz-heading)]">
                  Welcome {user?.name || 'Admin'}!
                </p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/profile') }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
                >
                  <User size={16} /> Profile
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/settings') }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
                >
                  <Settings size={16} /> Settings
                </button>
              </div>
              <div className="border-t border-[var(--vz-border)] py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-[var(--vz-input-bg)] transition-colors"
                >
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function NotificationBell({ notifRef, notifOpen, setNotifOpen, navigate }) {
  const { user } = useSelector((s) => s.auth)
  const isOwner = user?.role === 'owner'
  const [markAsRead] = useMarkAsReadMutation()
  const { data } = useGetNotificationsQuery({ limit: 50, userId: user?._id || user?.id }, { skip: isOwner || !(user?._id || user?.id) })
  const notifications = data?.data || []
  const unreadCount = notifications.filter((n) => !n.isRead).length
  const location = useLocation()
  
  const hideCount = notifOpen || location.pathname === '/notifications'

  return (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => setNotifOpen(!notifOpen)}
        className="relative p-2.5 rounded-lg text-[var(--vz-topbar-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && !hideCount && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-danger text-white text-[9px] font-bold rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {notifOpen && (
        <div className="absolute right-0 top-12 w-[320px] bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[var(--vz-border)] flex items-center justify-between">
            <h6 className="text-sm font-semibold text-[var(--vz-heading)]">
              Notifications {unreadCount > 0 && <span className="text-xs text-danger">({unreadCount})</span>}
            </h6>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--vz-text-muted)]">
                No new notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n._id} 
                  onClick={async () => {
                    setNotifOpen(false);
                    if (!n.isRead) {
                      try { await markAsRead({ ids: [n._id], userId: user?._id || user?.id }).unwrap(); } catch {}
                    }
                    if (n.actionUrl) {
                      navigate(n.actionUrl);
                    }
                  }}
                  className={`px-4 py-2.5 border-b border-[var(--vz-border)] last:border-0 cursor-pointer hover:bg-[var(--vz-input-bg)] ${!n.isRead ? 'bg-primary/5' : ''}`}
                >
                  <p className={`text-xs ${n.isRead ? 'text-[var(--vz-text)]' : 'text-[var(--vz-heading)] font-medium'}`}>
                    {n.title || n.message}
                  </p>
                  <p className="text-[10px] text-[var(--vz-text-muted)] mt-0.5">
                    {new Date(n.meta?.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => { setNotifOpen(false); navigate('/notifications') }}
            className="w-full px-4 py-2.5 text-xs font-medium text-primary hover:bg-[var(--vz-input-bg)] border-t border-[var(--vz-border)] transition-colors"
          >
            View All Notifications
          </button>
        </div>
      )}
    </div>
  )
}
