import { useSelector } from 'react-redux'
import { useGetMeQuery } from '../features/auth/authApi'

export function useAuth() {
    const { user, token, isAuthenticated } = useSelector((s) => s.auth)

    // Skip /auth/me for owner — owner JWT has no tenantId so it can't
    // pass through tenantResolver gateway middleware
    const isOwner = user?.role === 'owner'

    // Auto-fetch /me when we have a token.
    // We do NOT completely skip if `user` exists, because we want RTK Query 
    // to respond to `invalidateTags(['User'])` (e.g. from 403 feature block)
    // and to poll periodically for plan/feature updates.
    const { data, isLoading } = useGetMeQuery(undefined, {
        skip: !token || isOwner,
        pollingInterval: 120000, // Background sync every 2 minutes
    })

    const currentUser = user || data?.data

    return {
        user: currentUser,
        token,
        isAuthenticated,
        isLoading,
        isOwner,
        isAdmin: currentUser?.role === 'superadmin' || currentUser?.role === 'admin',
        isManager: currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || currentUser?.role === 'manager',
        role: currentUser?.role,
    }
}
