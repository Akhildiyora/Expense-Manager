import React, { useEffect, useState } from 'react'
import { useFriends } from '../queries/useFriends'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'
import { useCategories } from '../queries/useCategories'
import {
  UserIcon,
  XMarkIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { ExpenseDetailsDialog } from '../components/ExpenseDetailsDialog'
import { Select } from '../components/Select'

const FriendsPage: React.FC = () => {
  const { friends, loading, error, setFriends } = useFriends()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const { categories } = useCategories()
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [detailedBalances, setDetailedBalances] = useState<Record<string, { paid: number; userOwes: number; theyOwe: number }>>({})

  // Detailed view states
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null)
  const [friendExpenses, setFriendExpenses] = useState<any[]>([])
  const [loadingFriendExpenses, setLoadingFriendExpenses] = useState(false)
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState<any | null>(null)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'balance-high' | 'balance-low'>('default')

  const filteredFriends = React.useMemo(() => {
    let result = [...friends]
    
    if (search) {
      result = result.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    }

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'balance-high') {
       result.sort((a, b) => (balances[b.id] ?? 0) - (balances[a.id] ?? 0))
    } else if (sortBy === 'balance-low') {
       result.sort((a, b) => (balances[a.id] ?? 0) - (balances[b.id] ?? 0))
    }
    
    return result
  }, [friends, search, sortBy, balances])

  const fetchFriendExpenses = async (friendId: string) => {
    setLoadingFriendExpenses(true)
    try {
      // 1. Get IDs of expenses where this friend is in the split
      const { data: splitRows, error: splitErr } = await supabase
        .from('expense_splits')
        .select('expense_id')
        .eq('friend_id', friendId)
      
      if (splitErr) throw splitErr
      
      const splitExpenseIds = (splitRows || []).map(r => r.expense_id)
      
      // 2. Fetch all personal expenses (trip_id is null) where they are either the payer OR involved in a split
      let query = supabase
        .from('expenses')
        .select('*, expense_splits(*)')
        .is('trip_id', null) // STRICT SEPARATION
      
      if (splitExpenseIds.length > 0) {
        query = query.or(`payer_id.eq.${friendId},id.in.(${splitExpenseIds.join(',')})`)
      } else {
        query = query.eq('payer_id', friendId)
      }
      
      const { data, error: expErr } = await query.order('date', { ascending: false })
      
      if (expErr) throw expErr
      setFriendExpenses(data || [])
    } catch (err) {
      console.error('Failed to fetch friend expenses:', err)
    } finally {
      setLoadingFriendExpenses(false)
    }
  }

  const handleFriendClick = (friend: any) => {
    setSelectedFriend(friend)
    void fetchFriendExpenses(friend.id)
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized'
    const cat = categories.find((c: any) => c.id === categoryId)
    return cat ? cat.name : 'Unknown'
  }

  const getPayerName = (payerId: string | null) => {
    if (!payerId) return 'You'
    const f = friends.find(f => f.id === payerId)
    return f ? f.name : 'Unknown Friend'
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (!user) return
    setSaving(true)
    const { data, error: insertError } = await supabase
      .from('friends')
      .insert({ name: name.trim(), user_id: user.id })
      .select()
      .single()
    setSaving(false)
    if (insertError) return
    setFriends([data, ...friends])
    setName('')
  }

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm('Delete this friend? Existing splits will remain but friend will be removed.')
    if (!ok) return
    await supabase.from('friends').delete().eq('id', id)
    setFriends(friends.filter((f) => f.id !== id))
  }

  useEffect(() => {
    if (!user) {
      setBalances({})
      setDetailedBalances({})
      return
    }

    const fetchBalances = async () => {
      // STRICT SEPARATION: Fetch ONLY personal expenses with their splits
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('id, payer_id, amount, expense_splits(friend_id, owed_to_friend_id, share_amount)')
        .is('trip_id', null)

      if (expenseError) {
        console.error('Failed to fetch data:', expenseError)
        setBalances({})
        setDetailedBalances({})
        return
      }

      const expenses = (expenseData ?? []) as any[]

      const totals: Record<string, number> = {}
      const detailed: Record<string, { paid: number; userOwes: number; theyOwe: number }> = {}

      // Initialize detailed object for current friends
      friends.forEach(f => {
        detailed[f.id] = { paid: 0, userOwes: 0, theyOwe: 0 }
      })

      expenses.forEach((exp) => {
        // Calculate total paid by friend
        if (exp.payer_id) {
            if (!detailed[exp.payer_id]) detailed[exp.payer_id] = { paid: 0, userOwes: 0, theyOwe: 0 }
            detailed[exp.payer_id].paid += Number(exp.amount)
        }

        // Calculate splits
        const splits = exp.expense_splits || []
        splits.forEach((split: any) => {
            const amt = Number(split.share_amount ?? 0)
            if (amt === 0) return
            
            if (split.friend_id && !split.owed_to_friend_id) {
                // Friend owes user
                totals[split.friend_id] = (totals[split.friend_id] ?? 0) + amt
                if (!detailed[split.friend_id]) detailed[split.friend_id] = { paid: 0, userOwes: 0, theyOwe: 0 }
                detailed[split.friend_id].theyOwe += amt
            } else if (!split.friend_id && split.owed_to_friend_id) {
                // User owes friend
                totals[split.owed_to_friend_id] = (totals[split.owed_to_friend_id] ?? 0) - amt
                if (!detailed[split.owed_to_friend_id]) detailed[split.owed_to_friend_id] = { paid: 0, userOwes: 0, theyOwe: 0 }
                detailed[split.owed_to_friend_id].userOwes += amt
            }
        })
      })

      setBalances(totals)
      setDetailedBalances(detailed)
    }

    void fetchBalances()
  }, [user, friends])

  const toGet = Object.entries(balances).filter(([, v]) => v > 0.005).reduce((s, [, v]) => s + v, 0)
  const toPay = Object.entries(balances).filter(([, v]) => v < -0.005).reduce((s, [, v]) => s + Math.abs(v), 0)

  return (
    <div className="space-y-6">
      <header className="pt-14 md:pt-0">
        <h2 className="text-xl font-semibold text-slate-50">Friends</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage people you split with. Balances: to get from others / to pay to others.
        </p>
      </header>

      {(toGet > 0 || toPay > 0) && (
        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-4">
            <p className="text-xs text-emerald-400/90 font-medium">To get</p>
            <p className="text-lg font-bold text-emerald-300">₹{toGet.toFixed(2)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Others owe you</p>
          </div>
          <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-4">
            <p className="text-xs text-amber-400/90 font-medium">To pay</p>
            <p className="text-lg font-bold text-amber-300">₹{toPay.toFixed(2)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">You owe others</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end text-sm">
          <div className="flex-1 min-w-[160px]">
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">Add New Friend</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friend's name"
              className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-medium disabled:opacity-60 transition"
          >
            {saving ? 'Adding…' : 'Add friend'}
          </button>
        </form>
      </section>



      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-2 rounded-2xl border border-slate-800/50">
         <input 
            type="text"
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
         />
         <div className="w-full sm:w-48">
            <Select
               value={sortBy}
               onChange={(val) => setSortBy(val as 'name' | 'balance-high' | 'balance-low')}
               options={[
                  { value: 'default', label: 'Default (Newest)' },
                  { value: 'name', label: 'Name (A-Z)' },
                  { value: 'balance-high', label: 'To Get (High-Low)' },
                  { value: 'balance-low', label: 'To Pay (High-Low)' },
               ]}
               placeholder="Sort by"
            />
         </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400 flex gap-2 sm:gap-4 min-w-[600px]">
          <div className="flex-1 min-w-[120px]">Name</div>
          <div className="w-24 text-right">Total Paid</div>
          <div className="w-24 text-right">You Owe</div>
          <div className="w-24 text-right">They Owe</div>
          <div className="w-32 sm:w-40 shrink-0 text-right">Net Balance</div>
          <div className="w-16 sm:w-20 shrink-0 text-right">Actions</div>
        </div>
        {loading && (
          <div className="px-4 py-6 text-sm text-slate-400">Loading friends…</div>
        )}
        {error && (
          <div className="px-4 py-4 text-sm text-red-400">Error: {error}</div>
        )}
        {!loading && friends.length === 0 && !error && (
          <div className="px-4 py-8 text-sm text-slate-400 text-center">
            No friends yet. Add people you usually split with.
          </div>
        )}
        <ul className="divide-y divide-slate-800 min-w-[600px]">
          {filteredFriends.map((f) => {
            const bal = balances[f.id] ?? 0
            const details = detailedBalances[f.id] ?? { paid: 0, userOwes: 0, theyOwe: 0 }
            const isSettled = Math.abs(bal) < 0.005
            return (
              <li
                key={f.id}
                onClick={() => handleFriendClick(f)}
                className="px-4 py-3 text-sm text-slate-200 flex items-center gap-2 sm:gap-4 hover:bg-slate-800/40 transition cursor-pointer group"
              >
                <div className="flex-1 font-medium min-w-0 truncate group-hover:text-emerald-400 transition">{f.name}</div>
                <div className="w-24 text-right text-slate-400">₹{details.paid.toFixed(2)}</div>
                <div className="w-24 text-right text-amber-500/80">₹{details.userOwes.toFixed(2)}</div>
                <div className="w-24 text-right text-emerald-500/80">₹{details.theyOwe.toFixed(2)}</div>
                <div className="w-32 sm:w-40 shrink-0 text-right">
                  {isSettled ? (
                    <span className="text-slate-500">Settled</span>
                  ) : bal > 0 ? (
                    <span className="text-emerald-400 font-medium">To get ₹{bal.toFixed(2)}</span>
                  ) : (
                    <span className="text-amber-400 font-medium">To pay ₹{Math.abs(bal).toFixed(2)}</span>
                  )}
                </div>
                <div className="w-16 sm:w-20 shrink-0 text-right">
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-300 text-xs font-medium"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDelete(f.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Friend Detailed Transactions Modal */}
      {selectedFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
             <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                   <UserIcon className="w-6 h-6" />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-100">{selectedFriend.name}</h3>
                   <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Transaction History</p>
                 </div>
               </div>
               <button
                 onClick={() => setSelectedFriend(null)}
                 className="text-slate-400 hover:text-slate-200 transition p-2 hover:bg-slate-800 rounded-xl"
               >
                 <XMarkIcon className="w-5 h-5" />
               </button>
             </div>

             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
               {loadingFriendExpenses ? (
                 <div className="text-center py-20 text-slate-500 italic">Finding transactions...</div>
               ) : friendExpenses.length === 0 ? (
                 <div className="text-center py-20">
                   <TagIcon className="w-12 h-12 text-slate-800 mx-auto mb-3 opacity-20" />
                   <p className="text-slate-500">No shared transactions found with {selectedFriend.name}.</p>
                 </div>
               ) : (
                 <div className="grid gap-3">
                   {friendExpenses.map((expense) => (
                     <div
                       key={expense.id}
                       onClick={() => setSelectedExpenseForDetails(expense)}
                       className="bg-slate-800/40 rounded-2xl p-4 flex items-center justify-between border border-slate-700/50 hover:border-emerald-500/40 transition cursor-pointer group"
                     >
                        <div className="flex items-center gap-4 min-w-0">
                           <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-[11px] shrink-0 font-bold text-slate-400">
                             <span>{new Date(expense.date).getDate()}</span>
                             <span className="uppercase text-[9px] text-slate-500">{new Date(expense.date).toLocaleString('default', { month: 'short' })}</span>
                           </div>
                           <div className="min-w-0">
                             <p className="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition truncate">{expense.title}</p>
                             <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/50">
                                 <TagIcon className="w-3 h-3" /> {getCategoryName(expense.category_id)}
                               </span>
                               <span className="text-[10px] text-slate-500 font-medium">•</span>
                               <span className="text-[10px] text-slate-500 font-medium">Paid by {getPayerName(expense.payer_id)}</span>
                             </div>
                           </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                           <p className="text-sm font-bold text-slate-100">₹{Number(expense.amount).toFixed(2)}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0 flex justify-between items-center">
                <p className="text-sm text-slate-400">
                  Net Balance: 
                  <span className={`ml-2 font-bold ${balances[selectedFriend.id] >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {balances[selectedFriend.id] >= 0 ? `To get ₹${balances[selectedFriend.id]?.toFixed(2)}` : `To pay ₹${Math.abs(balances[selectedFriend.id] || 0)?.toFixed(2)}`}
                  </span>
                </p>
                <button 
                  onClick={() => setSelectedFriend(null)}
                  className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition"
                >
                  Close
                </button>
             </div>
          </div>
        </div>
      )}

      <ExpenseDetailsDialog
        isOpen={!!selectedExpenseForDetails}
        onClose={() => setSelectedExpenseForDetails(null)}
        expense={selectedExpenseForDetails}
        categoryName={selectedExpenseForDetails ? getCategoryName(selectedExpenseForDetails.category_id) : ''}
        payerName={selectedExpenseForDetails ? getPayerName(selectedExpenseForDetails.payer_id) : ''}
        onEdit={(id) => {
          window.location.href = `/app/expenses?edit=${id}`
        }}
        onDelete={async (id) => {
          if (window.confirm('Delete this expense?')) {
            await supabase.from('expenses').delete().eq('id', id)
            setFriendExpenses(prev => prev.filter(e => e.id !== id))
          }
        }}
      />
    </div>
  )
}

export default FriendsPage

