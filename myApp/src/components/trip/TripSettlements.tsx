import React from 'react'
import { UserGroupIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

interface TripSettlementsProps {
  memberStats: any
  settlements: any[]
  onManageMembers: () => void
  onRemind: (friendId: string, amount: number) => void
  onSettle: (friendId: string, amount: number) => void
}

export const TripSettlements: React.FC<TripSettlementsProps> = ({
  memberStats,
  settlements,
  onManageMembers,
  onRemind,
  onSettle
}) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                
                {/* Actions based on balance */}
                {/* If mid is not user, and there is a balance to settle */}
                {mid !== 'user' && Math.abs(stats.balance) > 1 && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         {/* If friend owes (balance < 0 for them relative to group? No.
                            Balance logic:
                            Friend balance positive -> Paid more -> Owed money.
                            Friend balance negative -> Paid less -> Owes money.
                            
                            BUT this is GLOBAL balance.
                            Settlements details specific debts.
                            Focus actions on Settlements section below for specific pairwise debts.
                            OR here if we assume 1:1.
                            
                            Let's use the SETTLEMENTS section for actions as it is pairwise.
                          */}
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Settlements */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <ArrowsRightLeftIcon className="w-4 h-4 text-sky-400" /> Final Settlements
        </h3>
        <div className="bg-sky-950/20 border border-sky-900/30 rounded-2xl p-4 text-sm h-full">
          {settlements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-slate-500 italic">
               <ArrowsRightLeftIcon className="w-8 h-8 mb-2 opacity-20" />
               <p>Everyone is settled up!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {settlements.map((s, idx) => {
                 // Assuming 'user' id is passed or handled. 
                 // In TripDetailsPage: 'user' key is used for current user in memberStats logic.
                 // Settlements construction: 
                 // debtor.id came from memberStats keys. 
                 // So if key was 'user', it's 'user'. 
                 // But wait, memberStats keys are friend_ids. 
                 // 'user' key is literally 'user'.
                 
                 const payerIsMe = s.fromId === 'user'
                 const receiverIsMe = s.toId === 'user'

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
  )
}
