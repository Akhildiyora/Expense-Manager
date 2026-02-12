import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage from './pages/ExpensesPage'
import BudgetsPage from './pages/BudgetsPage'
import CategoriesPage from './pages/CategoriesPage'
import FriendsPage from './pages/FriendsPage'
import TripsPage from './pages/TripsPage'
import TripDetailsPage from './pages/TripDetailsPage'
import ProfilePage from './pages/ProfilePage'
import AppLayout from './layout/AppLayout'

const AuthGuard: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p className="text-sm text-slate-400">Checking session...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            
            <Route
              path="/app"
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="friends" element={<FriendsPage />} />
              <Route path="trips" element={<TripsPage />} />
              <Route path="trips/:id" element={<TripDetailsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
