import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useFriends } from '../queries/useFriends'
import {
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { getPersonalShare } from '../utils/expenseShare'

interface ExpenseDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  expense: any | null // Using any for now matching the raw expense object structure, or define a type
  categoryName: string
  payerName: string
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

interface SplitDetail {
  friend_id: string | null
  owed_to_friend_id: string | null
  share_amount: number
}

export const ExpenseDetailsDialog: React.FC<ExpenseDetailsDialogProps> = ({
  isOpen,
  onClose,
  expense,
  categoryName,
  payerName,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth()
  const { friends } = useFriends()
  
  const [splits, setSplits] = useState<SplitDetail[]>([])

  useEffect(() => {
    if (expense?.expense_splits) {
        setSplits(expense.expense_splits)
    } else {
        setSplits([])
    }
  }, [expense])

  if (!isOpen || !expense) return null

  const personalShare = getPersonalShare(expense)

  const getFriendName = (id: string | null) => {
      if (!id) return 'You'
      if (id === user?.id) return 'You'
      const f = friends.find(friend => friend.id === id)
      return f ? f.name : 'Unknown'
  }

  // Helper to interpret the split row
  const renderSplitRow = (split: SplitDetail) => {
    const debtorName = split.friend_id ? getFriendName(split.friend_id) : 'You'
    
    return (
        <div key={`${split.friend_id}-${split.owed_to_friend_id}`} className="flex justify-between items-center text-xs py-1">
            <span className="text-slate-300">{debtorName}</span>
            <span className="text-slate-400">₹{Number(split.share_amount).toFixed(2)}</span>
        </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Transaction Details</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="flex flex-col items-center justify-center py-2">
             <span className="text-3xl font-bold text-slate-100">
               ₹{Number(expense.amount).toFixed(2)}
             </span>
             <span className="text-sm text-slate-400 mt-1 uppercase tracking-wide">
               {expense.currency}
             </span>
             <span className="text-xs text-emerald-300 mt-2">
               Your share: ₹{personalShare.toFixed(2)}
             </span>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between border-b border-slate-800 pb-3">
               <span className="text-sm text-slate-400">Title</span>
               <span className="text-sm font-medium text-slate-200">{expense.title}</span>
             </div>
             
             <div className="flex justify-between border-b border-slate-800 pb-3">
               <span className="text-sm text-slate-400">Date</span>
               <span className="text-sm font-medium text-slate-200">{expense.date}</span>
             </div>

             <div className="flex justify-between border-b border-slate-800 pb-3">
               <span className="text-sm text-slate-400">Category</span>
               <span className="text-sm font-medium text-emerald-400">{categoryName}</span>
             </div>

             <div className="flex justify-between border-b border-slate-800 pb-3">
               <span className="text-sm text-slate-400">Paid By</span>
               <span className="text-sm font-medium text-slate-200">{payerName}</span>
             </div>
             
             {expense.note && (
               <div className="flex flex-col gap-1 border-b border-slate-800 pb-3">
                 <span className="text-sm text-slate-400">Note</span>
                 <p className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg mt-1 italic">
                   "{expense.note}"
                 </p>
               </div>
             )}
             
             <div className="flex flex-col gap-2 border-b border-slate-800 pb-3">
                <span className="text-sm text-slate-400">Split Details</span>
                {splits.length > 0 ? (
                    <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
                        <div className="flex justify-between items-center text-xs font-medium text-slate-400 mb-2 border-b border-slate-700/50 pb-1">
                            <span>Person</span>
                            <span>Amount</span>
                        </div>
                        {splits.map(split => renderSplitRow(split))}
                    </div>
                ) : (
                    <span className="text-sm font-medium text-slate-500">Not split (100% {payerName})</span>
                )}
             </div>

             {expense.is_recurring && (
               <div className="flex justify-between border-b border-slate-800 pb-3">
                 <span className="text-sm text-slate-400">Recurring</span>
                 <span className="text-sm font-medium text-blue-400 capitalize">
                   Yes ({expense.recurring_frequency})
                 </span>
               </div>
             )}
          </div>
        </div>


        {(onEdit || onDelete) && (
          <div className="p-6 pt-0 flex gap-3 mt-auto">
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(expense.id)
                  onClose()
                }}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 text-sm font-bold text-slate-950 transition shadow-lg shadow-emerald-900/20"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(expense.id)
                  onClose()
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 py-2.5 text-sm font-bold text-rose-500 transition border border-rose-500/20"
                title="Delete Transaction"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
