import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import DashboardLayout from '../components/layout/DashboardLayout'
import PermissionGate from '../components/auth/PermissionGate'

import OwnerLayout from '../components/layout/OwnerLayout'

const Login = lazy(() => import('../pages/auth/Login'))
const Register = lazy(() => import('../pages/auth/Register'))
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const LandingPage = lazy(() => import('../pages/LandingPage'))
const Pricing = lazy(() => import('../pages/Pricing'))
const LeadsList = lazy(() => import('../pages/leads/LeadsList'))
const LeadDetail = lazy(() => import('../pages/leads/LeadDetail'))
const FollowUpsList = lazy(() => import('../pages/follow-ups/FollowUpsList'))
const TasksList = lazy(() => import('../pages/tasks/TasksList'))
const CallLogs = lazy(() => import('../pages/calls/CallLogs'))
const WhatsApp = lazy(() => import('../pages/whatsapp/WhatsApp'))
const TeamInbox = lazy(() => import('../pages/whatsapp/TeamInbox'))
const SmartForms = lazy(() => import('../pages/forms/SmartForms'))
const Meetings = lazy(() => import('../pages/meetings/Meetings'))
const MeetingDetail = lazy(() => import('../components/meetings/MeetingDetail'))
const BookMeeting = lazy(() => import('../pages/meetings/BookMeeting'))
const Automations = lazy(() => import('../pages/automations/Automations'))
const AutomationBuilder = lazy(() => import('../pages/automations/AutomationBuilder'))
const Analytics = lazy(() => import('../pages/analytics/Analytics'))
const Settings = lazy(() => import('../pages/settings/Settings'))
const Billing = lazy(() => import('../pages/billing/Billing'))
const AuditLogs = lazy(() => import('../pages/audit/AuditLogs'))
const RecordAuditHistory = lazy(() => import('../pages/audit/RecordAuditHistory'))
const Notifications = lazy(() => import('../pages/notifications/Notifications'))
const RolesList = lazy(() => import('../pages/admin/RolesList'))
const RolePermissions = lazy(() => import('../pages/admin/RolePermissions'))
const UsersList = lazy(() => import('../pages/admin/UsersList'))
const ModulesManager = lazy(() => import('../pages/admin/ModulesManager'))
const BranchManager = lazy(() => import('../pages/admin/BranchManager'))
const Profile = lazy(() => import('../pages/profile/Profile'))
const OwnerLogin = lazy(() => import('../pages/owner/OwnerLogin'))
const OwnerDashboard = lazy(() => import('../pages/owner/OwnerDashboard'))
const OwnerTenants = lazy(() => import('../pages/owner/OwnerTenants'))
const OwnerTenantDetail = lazy(() => import('../pages/owner/OwnerTenantDetail'))
const OwnerPlans = lazy(() => import('../pages/owner/OwnerPlans'))
const OwnerRevenue = lazy(() => import('../pages/owner/OwnerRevenue'))
const OwnerActivity = lazy(() => import('../pages/owner/OwnerActivity'))
const OwnerSettings = lazy(() => import('../pages/owner/OwnerSettings'))
const OwnerPayments = lazy(() => import('../pages/owner/OwnerPayments'))

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useSelector((s) => s.auth)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Owner should never land on tenant dashboard — redirect to /owner
  if (user?.role === 'owner') return <Navigate to="/owner" replace />
  return children
}

// Owner route guard — only allows role === 'owner'
function OwnerRoute({ children }) {
  const { isAuthenticated, user } = useSelector((s) => s.auth)
  if (!isAuthenticated) return <Navigate to="/owner/login" replace />
  if (user?.role !== 'owner') return <Navigate to="/dashboard" replace />
  return children
}

// Feature-gated route guard — checks if tenant has the required feature
function FeatureRoute({ feature, children }) {
  const { features, featuresLoaded, user } = useSelector((s) => s.auth)
  // The system owner bypasses all feature restrictions
  if (user?.role === 'owner') return children
  // While features haven't been loaded from the server yet, render nothing
  // (prevents a brief flash of accessible content before hydration)
  if (!featuresLoaded) return null
  // Feature is in the tenant's plan → allow
  if (features.includes(feature)) return children
  // Feature not in plan → redirect to dashboard
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-primary">Loading SparkCRM...</div>}>
      <Routes>
        {/* Public routes (no layout) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/book/:slug" element={<BookMeeting />} />

        {/* Owner Login (public) */}
        <Route path="/owner/login" element={<OwnerLogin />} />

        {/* Owner Panel routes */}
        <Route
          element={
            <OwnerRoute>
              <OwnerLayout />
            </OwnerRoute>
          }
        >
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/owner/tenants" element={<OwnerTenants />} />
          <Route path="/owner/tenants/:id" element={<OwnerTenantDetail />} />
          <Route path="/owner/plans" element={<OwnerPlans />} />
          <Route path="/owner/revenue" element={<OwnerRevenue />} />
          <Route path="/owner/payments" element={<OwnerPayments />} />
          <Route path="/owner/activity" element={<OwnerActivity />} />
          <Route path="/owner/settings" element={<OwnerSettings />} />
        </Route>

        {/* Dashboard routes (with layout) */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<FeatureRoute feature="lead_management"><LeadsList /></FeatureRoute>} />
          <Route path="/leads/:id" element={<FeatureRoute feature="lead_management"><LeadDetail /></FeatureRoute>} />
          <Route path="/follow-ups" element={<FeatureRoute feature="lead_management"><FollowUpsList /></FeatureRoute>} />
          <Route path="/tasks" element={<FeatureRoute feature="task_management"><TasksList /></FeatureRoute>} />
          <Route path="/calls" element={<FeatureRoute feature="calling_basic"><CallLogs /></FeatureRoute>} />
          <Route path="/whatsapp" element={<FeatureRoute feature="whatsapp_session"><WhatsApp /></FeatureRoute>} />
          <Route path="/whatsapp/inbox" element={<FeatureRoute feature="whatsapp_session"><TeamInbox /></FeatureRoute>} />
          <Route path="/whatsapp/broadcasts" element={<FeatureRoute feature="whatsapp_session"><WhatsApp /></FeatureRoute>} />
          <Route path="/forms" element={<FeatureRoute feature="smart_forms"><SmartForms /></FeatureRoute>} />
          <Route path="/meetings" element={<FeatureRoute feature="meeting_scheduler"><Meetings /></FeatureRoute>} />
          <Route path="/meetings/:id" element={<FeatureRoute feature="meeting_scheduler"><MeetingDetail /></FeatureRoute>} />
          <Route path="/automations" element={<FeatureRoute feature="automation_basic"><Automations /></FeatureRoute>} />
          <Route path="/automations/builder" element={<FeatureRoute feature="automation_basic"><AutomationBuilder /></FeatureRoute>} />
          <Route path="/automations/builder/:id" element={<FeatureRoute feature="automation_basic"><AutomationBuilder /></FeatureRoute>} />
          <Route path="/analytics" element={<FeatureRoute feature="analytics_basic"><Analytics /></FeatureRoute>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/audit" element={<AuditLogs />} />
          <Route path="/audit/record/:recordId" element={<RecordAuditHistory />} />
          <Route path="/notifications" element={<Notifications />} />

          {/* Admin routes — permission-gated */}
          <Route path="/admin/roles" element={<PermissionGate module="roles"><RolesList /></PermissionGate>} />
          <Route path="/admin/roles/:id" element={<PermissionGate module="roles"><RolePermissions /></PermissionGate>} />
          <Route path="/admin/users" element={<PermissionGate module="users"><UsersList /></PermissionGate>} />
          <Route path="/admin/modules" element={<PermissionGate module="modules"><ModulesManager /></PermissionGate>} />
          <Route path="/admin/branches" element={<PermissionGate module="branches"><BranchManager /></PermissionGate>} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

