import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import NotificationDropdown from '../components/NotificationDropdown'
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'

const navItems = [
  { to: '/app', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { to: '/app/expenses', label: 'Expenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2zm-12-2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { to: '/app/budgets', label: 'Budgets', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { to: '/app/categories', label: 'Categories', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { to: '/app/friends', label: 'Friends', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { to: '/app/trips', label: 'Trips', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
]

const AppLayout: React.FC = () => {
  const { user, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false) // For mobile
  const [collapsed, setCollapsed] = useState(false) // For desktop
  const [notificationOpen, setNotificationOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex md:flex-row">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen inset-y-0 left-0 z-50 border-r border-slate-800/80 bg-slate-900/95 md:bg-slate-900/80 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } w-64 ${collapsed ? 'md:w-20' : ''}`}
      >
          <div className={`p-4 border-b border-slate-800/80 flex items-center shrink-0 h-16 ${collapsed ? 'md:justify-center' : 'justify-between'}`}>
            <div className={`overflow-hidden whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>
              <h1 className="text-lg font-bold tracking-tight text-slate-50 animate-in fade-in duration-300">Expense Tracker</h1>
            </div>

             {/* Collapse Toggle (Desktop) */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronDoubleRightIcon className="w-5 h-5" />
              ) : (
                <ChevronDoubleLeftIcon className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 -mr-2 text-slate-400 hover:text-slate-200"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/app'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
                  } ${collapsed ? 'md:justify-center' : ''}`
                }
                title={collapsed ? item.label : ''}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className={`whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-200 ${collapsed ? 'md:hidden' : ''}`}>
                    {item.label}
                </span>
                 {/* Tooltip for collapsed state if needed, relying on title attribute for simplicity now */}
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-800/80 shrink-0">
            <div className={`rounded-xl bg-slate-800/60 p-3 transition-all duration-300 flex flex-col ${collapsed ? 'md:items-center' : ''}`}>
                <div className={`w-full ${collapsed ? 'md:hidden' : ''}`}>
                    <NavLink to="/app/profile" className="block text-xs text-slate-400 truncate mb-2 hover:text-emerald-400 transition">
                        {user?.email}
                    </NavLink>
                    <button
                        type="button"
                        onClick={() => void signOut()}
                        className="w-full text-left text-xs font-medium text-slate-400 hover:text-emerald-400 transition flex items-center gap-2"
                    >
                        <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                        Log out
                    </button>
                </div>
                 <button
                    type="button"
                    onClick={() => void signOut()}
                    className={`p-2 text-slate-400 hover:text-emerald-400 transition hidden ${collapsed ? 'md:block' : ''}`}
                    title="Log out"
                 >
                    <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                 </button>
            </div>
          </div>
        </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Global Header */}
        <header className="h-16 shrink-0 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 z-30 sticky top-0">
            <div className="flex items-center gap-3">
                {/* Mobile Menu Toggle */}
                <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden -ml-2 p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition"
                    aria-label="Open menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            <div className="flex items-center gap-4">
                {/* Conditional Header Actions */}
                {/* Conditional Header Actions */}
                {location.pathname.match(/^\/app\/trips\/[^/]+/) ? (
                    <div id="trip-header-portal" className="flex items-center gap-4"></div>
                ) : (
                    <>
                        {/* Global Add Expense Button */}
                        <button
                            onClick={() => navigate('/app/expenses?new=1')}
                            className="hidden sm:flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-sm font-semibold transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Expense
                        </button>
                        <button
                            onClick={() => navigate('/app/expenses?new=1')}
                            className="sm:hidden flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 w-8 h-8 rounded-full text-sm font-semibold transition"
                            aria-label="Add Expense"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </>
                )}

                {/* Notifications (Always Visible) */}
                <div className="relative ml-2">
                    <button
                        onClick={() => setNotificationOpen(!notificationOpen)}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition relative"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    <NotificationDropdown 
                        isOpen={notificationOpen} 
                        onClose={() => setNotificationOpen(false)} 
                    />
                </div>
            </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6 custom-scrollbar">
            <div className="mx-auto max-w-6xl">
                <Outlet />
            </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
