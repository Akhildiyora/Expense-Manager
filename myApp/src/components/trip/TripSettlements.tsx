import React from 'react'
import { UserGroupIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

interface TripSettlementsProps {
  memberStats: any
  settlements: any[]
  onManageMembers: () => void
}

export const TripSettlements: React.FC<TripSettlementsProps> = ({
  memberStats,
  settlements,
  onManageMembers
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
              <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider">
                <span>Share: ₹{stats.share.toLocaleString()}</span>
                <span className={stats.balance >= 0 ? 'text-emerald-500' : 'text-rose-400'}>
                  {stats.balance >= 0 ? `+₹${stats.balance.toFixed(0)}` : `-₹${Math.abs(stats.balance).toFixed(0)}`}
                </span>
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
              {settlements.map((s, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-sky-900/20 transition">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{s.from}</span>
                    <span className="text-slate-500">→</span>
                    <span className="font-semibold text-slate-200">{s.to}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                    <span>₹{s.amount.toFixed(0)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
