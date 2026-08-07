import { useSelector, useDispatch } from 'react-redux'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '../../slices/authSlice'
import {
  LayoutDashboard, Users, CreditCard, Package, DollarSign,
  Settings, Activity, LogOut, ChevronLeft, ChevronRight, Shield, Moon, Sun,
} from 'lucide-react'
import { useState } from 'react'

const OWNER_MENU = [
  {
    label: 'MENU',
    items: [
      { path: '/owner', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { path: '/owner/tenants', label: 'Tenants', icon: Users },
      { path: '/owner/plans', label: 'Plans', icon: Package },
      { path: '/owner/revenue', label: 'Revenue', icon: DollarSign },
      { path: '/owner/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { path: '/owner/activity', label: 'Activity Logs', icon: Activity },
      { path: '/owner/settings', label: 'System Settings', icon: Settings },
    ],
  },
]

export default function OwnerLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((s) => s.auth)
  const [collapsed, setCollapsed] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  const sidebarWidth = collapsed ? 'w-[70px]' : 'w-[250px]'

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('sparkcrm_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('sparkcrm_theme', 'light')
    }
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/owner/login')
  }

  const linkClasses = (isActive) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-white/15 text-white shadow-sm'
        : 'text-[var(--vz-sidebar-text)] hover:text-white hover:bg-white/8'
    }`

  return (
    <div className="min-h-screen bg-[var(--vz-body-bg)] transition-colors duration-200">
      {/* Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 transition-all duration-300
          ${sidebarWidth} bg-[var(--vz-sidebar-bg)]`}
      >
        <nav className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-[70px] px-5 border-b border-white/10 shrink-0">
            {!collapsed && (
              <span className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Shield size={20} /> SparkCRM
              </span>
            )}
            {collapsed && <Shield size={20} className="text-white mx-auto" />}
          </div>

          {/* Menu */}
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            {OWNER_MENU.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--vz-sidebar-text)]/60">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.end}
                        className={({ isActive }) => linkClasses(isActive)}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon size={18} className="shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom controls */}
          <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[var(--vz-sidebar-text)] hover:text-white hover:bg-white/8 transition-all"
              title={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
              {!collapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-all"
              title="Logout"
            >
              <LogOut size={18} />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Topbar */}
      <header
        className={`fixed top-0 right-0 h-[70px] z-30 bg-[var(--vz-topbar-bg)] border-b border-[var(--vz-border)] transition-all duration-300 flex items-center px-6 justify-between`}
        style={{ left: collapsed ? '70px' : '250px' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-[var(--vz-input-bg)] text-[var(--vz-topbar-text)] transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <div className="flex items-center gap-2 text-xs text-[var(--vz-text-muted)]">
            <Shield size={14} className="text-primary" />
            <span className="font-semibold text-primary">Owner Panel</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--vz-heading)]">{user?.name || 'System Owner'}</p>
            <p className="text-[10px] text-[var(--vz-text-muted)]">System Owner</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            👑
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`pt-[70px] transition-all duration-300 ${collapsed ? 'md:ml-[70px]' : 'md:ml-[250px]'}`}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
