import React, { useRef, useEffect } from 'react'
import { useNotifications, type Notification } from '../context/NotificationContext'
import { useNavigate } from 'react-router-dom'

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { notifications, markAsRead, markAllAsRead } = useNotifications()
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    if (notification.type === 'expense' && notification.metadata?.expense_id) {
       // Navigate to expenses page and maybe highlight? 
       // For now just go to expenses page. 
       // If we want to open edit mode, we could use ?edit=ID
       navigate(`/app/expenses?edit=${notification.metadata.expense_id}`)
    } else if (notification.type === 'settlement') {
       navigate('/app/expenses')
    }
    
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
        ref={dropdownRef}
        className="absolute right-0 top-12 w-80 md:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
    >
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 backdrop-blur shrink-0">
        <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
        {notifications.length > 0 && (
             <button 
                onClick={() => void markAllAsRead()}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
             >
                Mark all read
             </button>
        )}
      </div>
      
      <div className="overflow-y-auto flex-1 custom-scrollbar">
          {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                  No notifications yet.
              </div>
          ) : (
              <ul className="divide-y divide-slate-800">
                  {notifications.map(notification => (
                      <li 
                        key={notification.id}
                        onClick={() => void handleNotificationClick(notification)}
                        className={`p-3 hover:bg-slate-800/50 cursor-pointer transition-colors ${!notification.is_read ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : ''}`}
                      >
                          <div className="flex gap-3">
                              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notification.is_read ? 'bg-emerald-500' : 'bg-transparent'}`} />
                              <div className="flex-1 min-w-0">
                                  <p className={`text-xs ${!notification.is_read ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                                      {notification.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                      {notification.message}
                                  </p>
                                  <p className="text-[10px] text-slate-600 mt-1.5">
                                      {new Date(notification.created_at).toLocaleString()}
                                  </p>
                              </div>
                          </div>
                      </li>
                  ))}
              </ul>
          )}
      </div>
    </div>
  )
}

export default NotificationDropdown
