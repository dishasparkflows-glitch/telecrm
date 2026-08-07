import { useSelector, useDispatch } from 'react-redux'
import { NavLink, useLocation } from 'react-router-dom'
import { closeMobileSidebar} from '../../slices/uiSlice'
import {
  LayoutDashboard, Users, Phone, MessageCircle, FileText,
  Calendar, Zap, BarChart3, Settings, CreditCard,
  ChevronDown, X, ClipboardList, Bell, Shield, UserCog, LayoutList, Box, Megaphone,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useListModulesQuery } from '../../features/modules/moduleApi'

/* Lucide icon name → component lookup */
const ICON_MAP = {
  LayoutDashboard, Users, Phone, MessageCircle, FileText,
  Calendar, Zap, BarChart3, Settings, CreditCard,
  ClipboardList, Bell, Shield, UserCog, LayoutList, Box, Megaphone,
}

/* Fallback static menu (used when modules not yet loaded from API) */
/* Only includes safe, non-restricted modules to prevent flashing restricted modules on refresh */
const FALLBACK_SECTIONS = [
  {
    label: 'MENU',
    items: [
      { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { key: 'settings', path: '/settings', label: 'Settings', icon: 'Settings' },
      { key: 'notifications', path: '/notifications', label: 'Notifications', icon: 'Bell' },
    ],
  },
]

export default function Sidebar() {
  const dispatch = useDispatch()
  const { sidebarCollapsed, mobileSidebarOpen } = useSelector((s) => s.ui)
  const { modules: authModules, permissions, user } = useSelector((s) => s.auth)
  const { data: modulesResp, isLoading: modulesLoading } = useListModulesQuery()
  const location = useLocation()
  const [openMenus, setOpenMenus] = useState({})

  const isSuperAdmin = user?.role === 'superadmin'

  /**
   * Build menu sections from dynamic modules, filtered by user permissions.
   * Priority order:
   *  1. Fresh API response (plan-filtered, authoritative)
   *  2. FALLBACK_SECTIONS while API is loading (dashboard + settings only — safe)
   *  3. authModules from Redux/localStorage ONLY if API has already succeeded once
   *     (prevents stale plan data from flashing during initial page load)
   */
  const menuSections = useMemo(() => {
    // If the API call is still in-flight and we have no response yet, show safe fallback
    if (modulesLoading && !modulesResp) return FALLBACK_SECTIONS

    // Use fresh API data if available; fall back to redux state (from last successful login)
    const modules = modulesResp?.data || authModules

    // If no modules at all, show safe fallback
    if (!modules || modules.length === 0) return FALLBACK_SECTIONS

    // Group modules by section, filter by view permission
    const sectionMap = {}
    const childrenMap = {} // parentKey → [child modules]

    for (const mod of modules) {
      // Permission check: super admin sees everything, others only see modules they have view access to
      const canView = isSuperAdmin || permissions?.[mod.key]?.view === true

      // Dashboard is always visible
      if (!canView && mod.key !== 'dashboard') continue

      if (mod.parentKey) {
        if (!childrenMap[mod.parentKey]) childrenMap[mod.parentKey] = []
        childrenMap[mod.parentKey].push(mod)
      } else {
        if (!sectionMap[mod.section]) sectionMap[mod.section] = []
        sectionMap[mod.section].push(mod)
      }
    }

    const sections = []
    const sectionOrder = ['MENU', 'ADMIN', 'SETTINGS']

    for (const secKey of sectionOrder) {
      const items = sectionMap[secKey]
      if (!items || items.length === 0) continue

      sections.push({
        label: secKey,
        items: items
          .sort((a, b) => a.order - b.order)
          .map((item) => ({
            key: item.key,
            path: item.path,
            label: item.label,
            icon: item.icon,
            children: (childrenMap[item.key] || [])
              .sort((a, b) => a.order - b.order)
              .map((c) => ({ key: c.key, path: c.path, label: c.label })),
          })),
      })
    }

    return sections
  }, [modulesResp, modulesLoading, authModules, permissions, isSuperAdmin])


  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const sidebarWidth = sidebarCollapsed ? 'w-[70px]' : 'w-[250px]'

  const linkClasses = (path) => {
    const isActive = location.pathname === path || location.pathname.startsWith(path + '/')
    return `flex items-center gap-3 px-4 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200 group
      ${isActive
        ? 'bg-white/10 text-white'
        : 'text-[var(--vz-sidebar-text)] hover:text-white hover:bg-white/5'
      }`
  }

  const getIcon = (iconName) => ICON_MAP[iconName] || Box

  const content = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-[70px] px-5 border-b border-white/10 shrink-0">
        {!sidebarCollapsed && (
          <span className="text-xl font-bold text-white tracking-tight">
            ⚡ SparkCRM
          </span>
        )}
        {sidebarCollapsed && <span className="text-xl font-bold text-white">⚡</span>}
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {menuSections.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--vz-sidebar-text)]/60">
                {section.label}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = getIcon(item.icon)

                return item.children && item.children.length > 0 ? (
                  <li key={item.key}>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200
                        text-[var(--vz-sidebar-text)] hover:text-white hover:bg-white/5`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={18} />
                        {!sidebarCollapsed && item.label}
                      </span>
                      {!sidebarCollapsed && (
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${
                            openMenus[item.label] ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </button>
                    {openMenus[item.label] && !sidebarCollapsed && (
                      <ul className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-3">
                        {item.children.map((child) => (
                          <li key={child.key}>
                            <NavLink
                              to={child.path}
                              onClick={() => dispatch(closeMobileSidebar())}
                              className={linkClasses(child.path)}
                            >
                              <span className="w-1 h-1 rounded-full bg-current opacity-60" />
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ) : (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      onClick={() => dispatch(closeMobileSidebar())}
                      className={linkClasses(item.path)}
                    >
                      <Icon size={18} />
                      {!sidebarCollapsed && item.label}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 transition-all duration-300
          ${sidebarWidth} bg-[var(--vz-sidebar-bg)]`}
      >
        {content}
      </aside>

      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => dispatch(closeMobileSidebar())}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[250px] z-50 bg-[var(--vz-sidebar-bg)] transition-transform duration-300 md:hidden
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button
          onClick={() => dispatch(closeMobileSidebar())}
          className="absolute top-5 right-4 text-white/60 hover:text-white"
        >
          <X size={20} />
        </button>
        {content}
      </aside>
    </>
  )
}
