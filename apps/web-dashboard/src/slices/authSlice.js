import { createSlice } from '@reduxjs/toolkit'

const storedPermissions = localStorage.getItem('sparkcrm_permissions')
const storedModules = localStorage.getItem('sparkcrm_modules')
const storedBranches = localStorage.getItem('sparkcrm_branches')
const storedActiveBranch = localStorage.getItem('sparkcrm_active_branch')
const storedUser = localStorage.getItem('sparkcrm_user')
const storedFeatures = localStorage.getItem('sparkcrm_features')
const storedPlan = localStorage.getItem('sparkcrm_plan')
const storedSubscription = localStorage.getItem('sparkcrm_subscription')

const initialState = {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: localStorage.getItem('sparkcrm_token') || null,
    isAuthenticated: !!localStorage.getItem('sparkcrm_token'),
    loading: false,
    permissions: storedPermissions ? JSON.parse(storedPermissions) : {},
    modules: storedModules ? JSON.parse(storedModules) : [],
    branches: storedBranches ? JSON.parse(storedBranches) : [],
    activeBranchId: storedActiveBranch || null,
    features: storedFeatures ? JSON.parse(storedFeatures) : [],
    featuresLoaded: !!localStorage.getItem('sparkcrm_token'), // true if we already have a session (token + stored features)
    plan: storedPlan ? JSON.parse(storedPlan) : null,
    subscription: storedSubscription ? JSON.parse(storedSubscription) : null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (state, action) => {
            state.user = action.payload.user
            state.token = action.payload.token
            state.isAuthenticated = true
            localStorage.setItem('sparkcrm_token', action.payload.token)

            // Persist user to localStorage (crucial for page refresh)
            if (action.payload.user) {
                localStorage.setItem('sparkcrm_user', JSON.stringify(action.payload.user))
            } else {
                localStorage.removeItem('sparkcrm_user')
            }

            // Store permissions and modules if provided (use !== undefined to allow empty {} or [])
            if (action.payload.permissions !== undefined) {
                state.permissions = action.payload.permissions
                localStorage.setItem('sparkcrm_permissions', JSON.stringify(action.payload.permissions))
            }
            if (action.payload.modules !== undefined) {
                state.modules = action.payload.modules
                localStorage.setItem('sparkcrm_modules', JSON.stringify(action.payload.modules))
            }
            // Store branches if provided
            if (action.payload.branches !== undefined) {
                state.branches = action.payload.branches
                localStorage.setItem('sparkcrm_branches', JSON.stringify(action.payload.branches))
                // Preserve 'all' if it was set during impersonation
                const currentBranch = state.activeBranchId || localStorage.getItem('sparkcrm_active_branch')
                if (currentBranch === 'all') {
                    state.activeBranchId = 'all'
                    localStorage.setItem('sparkcrm_active_branch', 'all')
                } else {
                    // Set active branch to user's assigned branch or the default one
                    const userBranch = action.payload.user?.branchId
                    const defaultBranch = action.payload.branches.find(b => b.isDefault)
                    const activeBranchId = userBranch || defaultBranch?._id || action.payload.branches[0]?._id || null
                    state.activeBranchId = activeBranchId
                    localStorage.setItem('sparkcrm_active_branch', activeBranchId || '')
                }
            }
            // Store features, plan, and subscription if provided
            if (action.payload.features !== undefined) {
                state.features = action.payload.features
                state.featuresLoaded = true
                localStorage.setItem('sparkcrm_features', JSON.stringify(action.payload.features))
            }
            if (action.payload.plan !== undefined) {
                state.plan = action.payload.plan
                localStorage.setItem('sparkcrm_plan', JSON.stringify(action.payload.plan))
            }
            if (action.payload.subscription !== undefined) {
                state.subscription = action.payload.subscription
                localStorage.setItem('sparkcrm_subscription', JSON.stringify(action.payload.subscription))
            }
        },
        setActiveBranch: (state, action) => {
            state.activeBranchId = action.payload
            localStorage.setItem('sparkcrm_active_branch', action.payload || '')
        },
        setBranches: (state, action) => {
            state.branches = action.payload || []
            localStorage.setItem('sparkcrm_branches', JSON.stringify(state.branches))
        },
        setPermissions: (state, action) => {
            state.permissions = action.payload.permissions || {}
            state.modules = action.payload.modules || []
            localStorage.setItem('sparkcrm_permissions', JSON.stringify(state.permissions))
            localStorage.setItem('sparkcrm_modules', JSON.stringify(state.modules))
        },
        /**
         * setFeatures — update plan/features/modules without a full re-login.
         * Called after billing webhook confirms plan upgrade/downgrade.
         */
        setFeatures: (state, action) => {
            if (action.payload.features !== undefined) {
                state.features = action.payload.features
                state.featuresLoaded = true
                localStorage.setItem('sparkcrm_features', JSON.stringify(action.payload.features))
            }
            if (action.payload.plan !== undefined) {
                state.plan = action.payload.plan
                localStorage.setItem('sparkcrm_plan', JSON.stringify(action.payload.plan))
            }
            if (action.payload.subscription !== undefined) {
                state.subscription = action.payload.subscription
                localStorage.setItem('sparkcrm_subscription', JSON.stringify(action.payload.subscription))
            }
            if (action.payload.modules !== undefined) {
                state.modules = action.payload.modules
                localStorage.setItem('sparkcrm_modules', JSON.stringify(action.payload.modules))
            }
        },
        logout: (state) => {
            state.user = null
            state.token = null
            state.isAuthenticated = false
            state.permissions = {}
            state.modules = []
            state.branches = []
            state.activeBranchId = null
            state.features = []
            state.featuresLoaded = false
            state.plan = null
            state.subscription = null
            localStorage.removeItem('sparkcrm_token')
            localStorage.removeItem('sparkcrm_user')
            localStorage.removeItem('sparkcrm_permissions')
            localStorage.removeItem('sparkcrm_modules')
            localStorage.removeItem('sparkcrm_branches')
            localStorage.removeItem('sparkcrm_active_branch')
            localStorage.removeItem('sparkcrm_features')
            localStorage.removeItem('sparkcrm_plan')
            localStorage.removeItem('sparkcrm_subscription')
            localStorage.removeItem('sparkcrm_owner_token')
            localStorage.removeItem('sparkcrm_owner_user')
            localStorage.removeItem('sparkcrm_impersonating')
        },
        setLoading: (state, action) => {
            state.loading = action.payload
        },
    },
})

export const { setCredentials, setActiveBranch, setBranches, setPermissions, setFeatures, logout, setLoading } = authSlice.actions
export default authSlice.reducer

