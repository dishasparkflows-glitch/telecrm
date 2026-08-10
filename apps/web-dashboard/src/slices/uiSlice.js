import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    sidebarOpen: true,
    sidebarCollapsed: false,
    theme: localStorage.getItem('sparkcrm_theme') || 'dark',
    mobileSidebarOpen: false,
    dialerOpen: false,
    dialerNumber: '',
    dialerLeadId: null,
}

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        toggleSidebar: (state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed
        },
        toggleMobileSidebar: (state) => {
            state.mobileSidebarOpen = !state.mobileSidebarOpen
        },
        closeMobileSidebar: (state) => {
            state.mobileSidebarOpen = false
        },
        openDialer: (state, action) => {
            state.dialerOpen = true
            if (action.payload && typeof action.payload === 'object') {
                state.dialerNumber = action.payload.phone || ''
                state.dialerLeadId = action.payload.leadId || null
            } else {
                state.dialerNumber = action.payload || ''
                state.dialerLeadId = null
            }
        },
        closeDialer: (state) => {
            state.dialerOpen = false
            state.dialerNumber = ''
            state.dialerLeadId = null
        },
        setTheme: (state, action) => {
            state.theme = action.payload
            localStorage.setItem('sparkcrm_theme', action.payload)
            if (action.payload === 'dark') {
                document.documentElement.classList.add('dark')
            } else {
                document.documentElement.classList.remove('dark')
            }
        },
        toggleTheme: (state) => {
            const newTheme = state.theme === 'dark' ? 'light' : 'dark'
            state.theme = newTheme
            localStorage.setItem('sparkcrm_theme', newTheme)
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark')
            } else {
                document.documentElement.classList.remove('dark')
            }
        },
    },
})

export const {
    toggleSidebar,
    toggleMobileSidebar,
    closeMobileSidebar,
    setTheme,
    toggleTheme,
    openDialer,
    closeDialer
} = uiSlice.actions
export default uiSlice.reducer
