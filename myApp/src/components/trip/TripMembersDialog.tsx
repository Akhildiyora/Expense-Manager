import React from 'react'
import { createPortal } from 'react-dom'
import {
  UserPlusIcon, 
  XMarkIcon,
  UserIcon
} from '@heroicons/react/24/outline'

interface TripMember {
  id: string
  user_id: string | null
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  email?: string | null
  friends: {
    name: string
    email?: string
  } | null
}

interface TripMembersDialogProps {
  open: boolean
  onClose: () => void
  members: TripMember[]
  currentUserId: string | undefined
  friends: any[] // Using any[] for simplicity, ideally Friend type
  onAddFriend: (member: TripMember) => void
  onBulkAdd?: () => void
}

export const TripMembersDialog: React.FC<TripMembersDialogProps> = ({
  open,
  onClose,
  members,
  currentUserId,
  friends,
  onAddFriend,
  onBulkAdd
}) => {
  if (!open) return null

  const isFriend = (member: TripMember) => {
    return friends.some(f => 
      (member.user_id && f.linked_user_id === member.user_id) || 
      (member.email && f.email === member.email)
    )
  }

  const hasNonFriends = members.some(m => m.user_id !== currentUserId && !isFriend(m))

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <h2 className="text-lg font-bold text-white">Trip Members</h2>
             {onBulkAdd && hasNonFriends && (
                 <button
                     onClick={onBulkAdd}
                     className="text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-1 rounded-lg hover:bg-sky-500/20 transition uppercase tracking-wider"
                 >
                     Add All to Friends
                 </button>
             )}
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {members.map(member => {
            const isMe = member.user_id === currentUserId
            const name = member.friends?.name || "Unknown Member"
            const alreadyFriend = isFriend(member)

            return (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                        {name}
                        {isMe && <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">YOU</span>}
                    </div>
                    <div className="text-xs text-slate-500">{member.email || 'No email'}</div>
                  </div>
                </div>

                {!isMe && !alreadyFriend && (
                  <button
                    onClick={() => onAddFriend(member)}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition group"
                    title="Add to Friends"
                  >
                    <UserPlusIcon className="w-5 h-5" />
                  </button>
                )}
                
                {alreadyFriend && !isMe && (
                    <div className="text-slate-600" title="Already a friend">
                        <UserIcon className="w-5 h-5" />
                    </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
