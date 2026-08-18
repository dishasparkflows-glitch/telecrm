import { useSelector } from 'react-redux'
import { ROLES } from '../utils/constants'

/**
 * Hook to check permissions for a specific module.
 *
 * @param {string} moduleKey - The module to check (e.g. 'leads', 'calls', 'roles')
 * @returns {{ hasPermission, canView, canCreate, canEdit, canDelete, canExport, canUpload, isSuperAdmin }}
 *
 * Usage:
 *   const { canView, canCreate, canDelete, isSuperAdmin } = usePermission('leads')
 *   if (!canCreate) return null  // Hide "Add Lead" button
 */
export function usePermission(moduleKey) {
    const { permissions, user } = useSelector((s) => s.auth)
    const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN

    const modulePerm = permissions?.[moduleKey] || {}

    const hasPermission = (action) => {
        if (isSuperAdmin) return true
        return modulePerm[action] === true
    }

    return {
        hasPermission,
        canView: isSuperAdmin || modulePerm.view === true,
        canCreate: isSuperAdmin || modulePerm.create === true,
        canEdit: isSuperAdmin || modulePerm.edit === true,
        canDelete: isSuperAdmin || modulePerm.delete === true,
        canExport: isSuperAdmin || modulePerm.export === true,
        canUpload: isSuperAdmin || modulePerm.upload === true,
        canImport: isSuperAdmin || modulePerm.import === true,
        isSuperAdmin,
        permissions: modulePerm,
    }
}

/**
 * Check if user has any specific module permission.
 * Useful in Sidebar to determine visibility.
 */
export function useCanViewModule(moduleKey) {
    const { permissions, user } = useSelector((s) => s.auth)
    if (user?.role === ROLES.SUPER_ADMIN) return true
    return permissions?.[moduleKey]?.view === true
}
