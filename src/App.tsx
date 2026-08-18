import { Navigate, Route, Routes } from 'react-router-dom'
import { type ReactNode } from 'react'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import AdminShell from './layouts/AdminShell'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

import DashboardPage from './pages/DashboardPage'

import TraineesPage from './pages/admin/TraineesPage'
import TraineeDetailPage from './pages/admin/TraineeDetailPage'
import CoursesPage from './pages/admin/CoursesPage'
import ReviewsPage from './pages/admin/ReviewsPage'
import SettingsPage from './pages/admin/SettingsPage'
import UsersPage from './pages/admin/UsersPage'

import MyTrainingPage from './pages/trainee/MyTrainingPage'
import MyPortfolioPage from './pages/trainee/MyPortfolioPage'
import MyAssessmentsPage from './pages/trainee/MyAssessmentsPage'
import MyProfilePage from './pages/trainee/MyProfilePage'

import ReportPage from './pages/ReportPage'
import AccountPage from './pages/AccountPage'

/*
 * Roles that are allowed to access /admin/*.
 */
const ADMIN_ROLES = [
  'mentor',
  'manager',
  'ma_center',
  'ma_board',
  'owner',
] as const

/*
 * Role guard for administrative UI.
 */
function AdminRoute({
  children,
}: {
  children: ReactNode
}) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading your workspace…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/dashboard" replace />
  }

  if (!ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

/*
 * Role guard for trainee UI.
 */
function TraineeRoute({
  children,
}: {
  children: ReactNode
}) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading your portfolio…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/dashboard" replace />
  }

  /*
   * Only MT accounts may access the trainee-side pages.
   */
  if (profile.role !== 'mt') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

/*
 * Report pages have their own role rules.
 */
function AdminReportRoute({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ProtectedRoute>
      <AdminRoute>{children}</AdminRoute>
    </ProtectedRoute>
  )
}

function MyReportRoute({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ProtectedRoute>
      <TraineeRoute>{children}</TraineeRoute>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* =========================================================
          Public routes
          ========================================================= */}

      <Route
        path="/"
        element={<LandingPage />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/signup"
        element={<SignUpPage />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />

      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      {/* =========================================================
          Administrative report
          ========================================================= */}

      <Route
        path="/admin/trainees/:id/report"
        element={
          <AdminReportRoute>
            <ReportPage />
          </AdminReportRoute>
        }
      />

      {/* =========================================================
          Trainee report
          ========================================================= */}

      <Route
        path="/my-report"
        element={
          <MyReportRoute>
            <ReportPage />
          </MyReportRoute>
        }
      />

      {/* =========================================================
          Authenticated application
          ========================================================= */}

      <Route
        element={
          <ProtectedRoute>
            <AdminShell />
          </ProtectedRoute>
        }
      >
        {/* -------------------------------------------------------
            Universal dashboard
            ------------------------------------------------------- */}

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        {/* -------------------------------------------------------
            Account
            ------------------------------------------------------- */}

        <Route
          path="/account"
          element={<AccountPage />}
        />

        {/* -------------------------------------------------------
            ADMIN UI
            ------------------------------------------------------- */}

        <Route
          path="/admin/trainees"
          element={
            <AdminRoute>
              <TraineesPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/trainees/:id"
          element={
            <AdminRoute>
              <TraineeDetailPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/courses"
          element={
            <AdminRoute>
              <CoursesPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/reviews"
          element={
            <AdminRoute>
              <ReviewsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <SettingsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />

        {/* -------------------------------------------------------
            TRAINEE UI
            ------------------------------------------------------- */}

        <Route
          path="/my-training"
          element={
            <TraineeRoute>
              <MyTrainingPage />
            </TraineeRoute>
          }
        />

        <Route
          path="/my-portfolio"
          element={
            <TraineeRoute>
              <MyPortfolioPage />
            </TraineeRoute>
          }
        />

        <Route
          path="/my-assessments"
          element={
            <TraineeRoute>
              <MyAssessmentsPage />
            </TraineeRoute>
          }
        />

        <Route
          path="/my-profile"
          element={
            <TraineeRoute>
              <MyProfilePage />
            </TraineeRoute>
          }
        />
      </Route>

      {/* =========================================================
          Fallback
          ========================================================= */}

      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}