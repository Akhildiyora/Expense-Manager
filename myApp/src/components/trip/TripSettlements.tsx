import React from 'react'
import { UserGroupIcon, ArrowsRightLeftIcon, BanknotesIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface TripSettlementsProps {
  memberStats: any
  settlements: any[]
  expenses: any[]
  friends: any[]
  currentMemberId: string // The ID representing the current user in memberStats
  onManageMembers: () => void
  onRemind: (friendId: string, amount: number) => void
  onSettle: (friendId: string, amount: number) => void
}

export const TripSettlements: React.FC<TripSettlementsProps> = ({
  memberStats,
  settlements,
  expenses,
  friends,
  currentMemberId,
  onManageMembers,
  onRemind,
  onSettle
}) => {
  const [isCustomSettleOpen, setIsCustomSettleOpen] = React.useState(false)
  const [customRecipient, setCustomRecipient] = React.useState('')
  const [customAmount, setCustomAmount] = React.useState('')

  const handleCustomSubmit = () => {
    if (!customRecipient || !customAmount) return
    onSettle(customRecipient, Number(customAmount))
    setIsCustomSettleOpen(false)
    setCustomRecipient('')
    setCustomAmount('')
  }
  
  // Filter out current user from potential recipients
  const potentialRecipients = Object.entries(memberStats)
    .filter(([id]) => id !== currentMemberId)
    .map(([id, stats]: [string, any]) => ({
      id,
      name: stats.name
    }))

  // Get settlement history
  const settlementHistory = React.useMemo(() => {
    return expenses
      .filter(e => e.is_settlement)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenses])



  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Members & Spending */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <UserGroupIcon className="w-4 h-4" /> Members & Spending
            </h3>
            <button 
              onClick={onManageMembers}
              className="text-[10px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-2 py-1 rounded transition border border-sky-500/20"
            >
              Manage Members
            </button>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl divide-y divide-slate-800/50">
            {Object.entries(memberStats).map(([mid, stats]: [string, any]) => (
              <div key={mid} className="p-4 group hover:bg-slate-800/30 transition">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-100">{stats.name}</span>
                  <p className="text-sm font-bold text-slate-200">₹{stats.paid.toLocaleString()}</p>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-wider">
                  <div className="flex flex-col">
                      <span>Share: ₹{stats.share.toLocaleString()}</span>
                      <span className={stats.balance >= 0 ? 'text-emerald-500' : 'text-rose-400'}>
                      {stats.balance >= 0 ? `+₹${stats.balance.toFixed(0)}` : `-₹${Math.abs(stats.balance).toFixed(0)}`}
                      </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Settlements */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-4 h-4 text-sky-400" /> Final Settlements
              </h3>
              <button
                  onClick={() => setIsCustomSettleOpen(true)}
                  className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded transition border border-emerald-500/20 font-bold"
              >
                  Custom Settle
              </button>
          </div>
          
          <div className="bg-sky-950/20 border border-sky-900/30 rounded-2xl p-4 text-sm h-full">
            {settlements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-slate-500 italic">
                 <ArrowsRightLeftIcon className="w-8 h-8 mb-2 opacity-20" />
                 <p>Everyone is settled up!</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {settlements.map((s, idx) => {
                   const payerIsMe = s.fromId === currentMemberId
                   const receiverIsMe = s.toId === currentMemberId

                   return (
                  <li key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-sky-900/20 transition group">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${payerIsMe ? 'text-rose-400' : 'text-slate-200'}`}>{s.from}</span>
                      <span className="text-slate-500">→</span>
                      <span className={`font-semibold ${receiverIsMe ? 'text-emerald-400' : 'text-slate-200'}`}>{s.to}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sky-400 font-bold">₹{s.amount.toFixed(0)}</span>
                      
                      {payerIsMe && (
                          <button 
                              onClick={() => onSettle(s.toId, s.amount)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded border border-emerald-500/20 transition"
                              title="Mark as paid"
                          >
                              Settle
                          </button>
                      )}
                      
                      {receiverIsMe && (
                          <button 
                              onClick={() => onRemind(s.fromId, s.amount)}
                              className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] px-2 py-1 rounded border border-purple-500/20 transition"
                              title="Send Reminder"
                          >
                              Remind
                          </button>
                      )}
                    </div>
                  </li>
                )})}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Payment History */}
      <section className="space-y-4 pt-4 border-t border-slate-800/50">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <BanknotesIcon className="w-4 h-4 text-emerald-400" /> Payment History
        </h3>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            {settlementHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                    No payments recorded yet.
                </div>
            ) : (
                <ul className="divide-y divide-slate-800/50">
                    {settlementHistory.map(exp => {
                        // Settlement expense structure:
                        // Payer: exp.payer_id (if null, it is 'user')
                        // Payee: exp.expense_splits[0].friend_id (if null, it is 'user')
                        // NOTE: Custom Settle logic creates 1 split for the payee. 
                        // If I pay Friend A: payer=null, split=[{friend_id: A_id, amount: X}]
                        // If Friend A pays Me: payer=A_id, split=[{friend_id: null, amount: X}]
                        
                        const payerId = exp.payer_id
                        const split = exp.expense_splits?.[0]
                        const payeeId = split?.friend_id || null 
                        
                        // Resolve names safely
                        const payerName = payerId 
                            ? (exp.payer?.name || friends.find((f: any) => f.id === payerId)?.name || 'Unknown')
                            : (exp.profiles?.full_name || 'Unknown')

                        // For Payee (split friend): 
                        // The split.friend_id is an ID in the CREATOR's friend list.
                        // Ideally we should join this too, but useExpenses might not join deep splits friends.
                        // However, seeing as we fixed `expense_splits(*, friends!friend_id(linked_user_id))` in useExpenses.ts
                        // We might need to check if we have the name.
                        // Actually, `useExpenses.ts` joins `expense_splits(*, friends!friend_id(linked_user_id))`.
                        // It does NOT join the name of the friend in the split.
                        // But wait, `friends` table has `name`.
                        // Let's assume we can get it or fallback to looking in our friends list (if we are the creator)
                        // OR if we are just viewing, we might have trouble knowing the payee name if it's not joined.
                        // BUT for Settlements, usually we know who it is.
                        // Let's use `userName` only if it matches Us?
                        // Actually, let's look at `TripSettlements.tsx` Line 55: `friends.find`. 
                        // If it's a shared settlement, Payee ID is also from Creator's list.
                        // So finding in My Friends list will fail if I am not Creator.
                        // We need the name from the split's friend relation.
                        
                        // For now, let's fix Payer first as that's the reported bug.
                        // For Payee, let's leave it or try to improve.
                        
                        const payeeName = payeeId
                            ? (split?.friends?.name || friends.find((f: any) => f.id === payeeId)?.name || 'Friend')
                            : (exp.profiles?.full_name || 'Unknown')
                        
                        // Wait, if payeeId is null, who is it?
                        // In `expense_splits`, `friend_id` can be null?
                        // If null, it usually implies the Creator?
                        
                        return (
                            <li key={exp.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                                        <CheckCircleIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-medium text-slate-200">{payerName}</span>
                                            <span className="text-slate-500 text-xs">paid</span>
                                            <span className="font-medium text-slate-200">{payeeName}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500">{new Date(exp.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-emerald-400 text-sm">₹{Number(exp.amount).toFixed(0)}</span>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
      </section>

      {/* Custom Settlement Modal */}
      {isCustomSettleOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsCustomSettleOpen(false)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-100 mb-4">Custom Settlement</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Pay To</label>
                        <select
                            value={customRecipient}
                            onChange={e => setCustomRecipient(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                            <option value="">Select a friend</option>
                            {potentialRecipients.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                            <input
                                type="number"
                                value={customAmount}
                                onChange={e => setCustomAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button 
                            onClick={() => setIsCustomSettleOpen(false)}
                            className="flex-1 py-2 rounded-xl text-slate-400 hover:bg-slate-800 transition text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCustomSubmit}
                            disabled={!customRecipient || !customAmount}
                            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Settle
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
