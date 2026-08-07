import { usePermission } from '../../hooks/usePermission'
import { Navigate } from 'react-router-dom'

/**
 * PermissionGate — wraps a route/component to enforce module permissions.
 *
 * @param {string} module   - Module key (e.g. 'leads', 'roles')
 * @param {string} action   - Required action (default: 'view')
 * @param {React.ReactNode} children
 * @param {string} fallbackPath - Where to redirect if denied (default: '/dashboard')
 *
 * Usage:
 *   <PermissionGate module="roles" action="view">
 *     <RolesList />
 *   </PermissionGate>
 */
export default function PermissionGate({ module, action = 'view', children, fallbackPath = '/dashboard' }) {
  const { hasPermission, isSuperAdmin } = usePermission(module)

  if (isSuperAdmin || hasPermission(action)) {
    return children
  }

  return <Navigate to={fallbackPath} replace />
}
