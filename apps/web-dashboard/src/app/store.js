import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { baseApi } from '../features/api/baseApi'
import authReducer from '../slices/authSlice'
import uiReducer from '../slices/uiSlice'

const appReducer = combineReducers({
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    ui: uiReducer,
})

/**
 * Root Reducer — Handles global state reset on logout
 * When auth/logout is dispatched, we reset the entire state to undefined,
 * which causes all child reducers (including API cache) to return their initial state.
 */
const rootReducer = (state, action) => {
    if (action.type === 'auth/logout') {
        // Clear persisted state in localStorage is already handled in authSlice,
        // but here we wipe the in-memory Redux store completely.
        state = undefined
    }
    return appReducer(state, action)
}

export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(baseApi.middleware),
})
