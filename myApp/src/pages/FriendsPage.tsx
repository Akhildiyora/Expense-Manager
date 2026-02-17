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
  const [email, setEmail] = useState('')
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
      // Find the selected friend and get their linked_user_id
      const selectedFriendRecord = friends.find(f => f.id === friendId)
      const linkedUserId = selectedFriendRecord?.linked_user_id
      
      // Get ALL friend_ids that represent this same person (via linked_user_id)
      const allFriendIdsForPerson: string[] = [friendId]
      if (linkedUserId) {
        const otherFriendIds = friends
          .filter(f => f.linked_user_id === linkedUserId && f.id !== friendId)
          .map(f => f.id)
        allFriendIdsForPerson.push(...otherFriendIds)
      }
      
      // 1. Get IDs of expenses where ANY of these friend_ids is in the split
      const { data: splitRows, error: splitErr } = await supabase
        .from('expense_splits')
        .select('expense_id')
        .in('friend_id', allFriendIdsForPerson)
      
      if (splitErr) throw splitErr
      
      const splitExpenseIds = (splitRows || []).map(r => r.expense_id)
      
      // 2. Fetch all personal expenses (trip_id is null) where they are either the payer OR involved in a split
      let query = supabase
        .from('expenses')
        .select('*, expense_splits(*)')
        .is('trip_id', null) // STRICT SEPARATION
      
      if (splitExpenseIds.length > 0) {
        query = query.or(`payer_id.in.(${allFriendIdsForPerson.join(',')}),id.in.(${splitExpenseIds.join(',')})`)
      } else {
        query = query.in('payer_id', allFriendIdsForPerson)
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

    try {
      let result;
      
      if (email.trim()) {
        // Use RPC to link user by email
        const { data, error } = await supabase.rpc('add_friend_by_email', {
          friend_name: name.trim(),
          friend_email: email.trim()
        })
        if (error) throw error
        
        // Fetch the full friend object since RPC returns partial/different structure or just ID
        // Actually RPC returns json with id, linked_user_id. We need full object for UI state.
        // Simplest is to just re-fetch or fetch single by ID.
        const { data: newFriend } = await supabase.from('friends').select('*').eq('id', (data as any).id).single()
        result = { data: newFriend, error: null }
      } else {
        // Standard insert
        result = await supabase
          .from('friends')
          .insert({ name: name.trim(), user_id: user.id })
          .select()
          .single()
      }

      if (result.error) throw result.error
      if (result.data) {
        setFriends([result.data, ...friends])
        setName('')
        setEmail('')
      }
    } catch (err) {
      console.error('Error adding friend:', err)
      alert('Failed to add friend. Please try again.')
    } finally {
       setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm('Delete this friend? Existing splits will remain but friend will be removed.')
    if (!ok) return
    await supabase.from('friends').delete().eq('id', id)
    setFriends(friends.filter((f) => f.id !== id))
  }

  // Edit Mode State
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const handleEditClick = (friend: any) => {
    setEditingId(friend.id)
    setName(friend.name)
    setEmail(friend.email || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setName('')
    setEmail('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !name.trim()) return
    setSaving(true)

    try {
      const { data, error } = await supabase.rpc('update_friend_with_email', {
        p_friend_id: editingId,
        p_name: name.trim(),
        p_email: email.trim() || null
      })

      if (error) throw error

      // Update local state
      setFriends(friends.map(f => f.id === editingId ? data : f))
      handleCancelEdit()
    } catch (err) {
      console.error('Error updating friend:', err)
      alert('Failed to update friend.')
    } finally {
      setSaving(false)
    }
  }

  // Modified Add/Update Form Handler
  const handleSubmit = (e: React.FormEvent) => {
    if (editingId) {
      handleUpdate(e)
    } else {
      handleAdd(e)
    }
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

      // Build a map of friend_id -> linked_user_id for cross-referencing
      const friendIdToLinkedUserId: Record<string, string> = {}
      const linkedUserIdToFriendIds: Record<string, string[]> = {}
      
      friends.forEach(f => {
        if (f.linked_user_id) {
          friendIdToLinkedUserId[f.id] = f.linked_user_id
          if (!linkedUserIdToFriendIds[f.linked_user_id]) {
            linkedUserIdToFriendIds[f.linked_user_id] = []
          }
          linkedUserIdToFriendIds[f.linked_user_id].push(f.id)
        }
      })

      const totals: Record<string, number> = {}
      const detailed: Record<string, { paid: number; userOwes: number; theyOwe: number }> = {}

      // Initialize detailed object for current friends
      friends.forEach(f => {
        detailed[f.id] = { paid: 0, userOwes: 0, theyOwe: 0 }
      })

      expenses.forEach((exp) => {
        // Helper to get all friend_ids that represent the same person
        const getAllFriendIds = (friendId: string): string[] => {
          const linkedUserId = friendIdToLinkedUserId[friendId]
          if (linkedUserId && linkedUserIdToFriendIds[linkedUserId]) {
            return linkedUserIdToFriendIds[linkedUserId]
          }
          return [friendId]
        }

        // Calculate total paid by friend
        if (exp.payer_id) {
          const allPayerIds = getAllFriendIds(exp.payer_id)
          allPayerIds.forEach(payerId => {
            if (!detailed[payerId]) detailed[payerId] = { paid: 0, userOwes: 0, theyOwe: 0 }
            detailed[payerId].paid += Number(exp.amount) / allPayerIds.length
          })
        }

        // Calculate splits
        const splits = exp.expense_splits || []
        splits.forEach((split: any) => {
            const amt = Number(split.share_amount ?? 0)
            if (amt === 0) return
            
            if (split.friend_id && !split.owed_to_friend_id) {
                // Friend owes user - distribute to all friend_ids representing this person
                const allFriendIds = getAllFriendIds(split.friend_id)
                allFriendIds.forEach(friendId => {
                  totals[friendId] = (totals[friendId] ?? 0) + (amt / allFriendIds.length)
                  if (!detailed[friendId]) detailed[friendId] = { paid: 0, userOwes: 0, theyOwe: 0 }
                  detailed[friendId].theyOwe += amt / allFriendIds.length
                })
            } else if (!split.friend_id && split.owed_to_friend_id) {
                // User owes friend - distribute to all friend_ids representing this person
                const allFriendIds = getAllFriendIds(split.owed_to_friend_id)
                allFriendIds.forEach(friendId => {
                  totals[friendId] = (totals[friendId] ?? 0) - (amt / allFriendIds.length)
                  if (!detailed[friendId]) detailed[friendId] = { paid: 0, userOwes: 0, theyOwe: 0 }
                  detailed[friendId].userOwes += amt / allFriendIds.length
                })
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
          Manage people you split with. Add their email to share data.
        </p>
      </header>

      {/* ... (Balances Section) ... */}
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
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3 items-end text-sm">
          <div className="flex-1 w-full md:min-w-[160px]">
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">
              {editingId ? 'Edit Name' : "Friend's Name"}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex-1 w-full md:min-w-[200px]">
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">
              {editingId ? 'Edit Email' : 'Email Address'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="To link account & share data"
              className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className={`w-full md:w-auto px-6 py-2 rounded-xl text-slate-950 text-sm font-medium disabled:opacity-60 transition shrink-0 ${
                editingId ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-500 hover:bg-emerald-400'
              }`}
            >
              {saving ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update' : 'Add friend')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
              >
                Cancel
              </button>
            )}
          </div>
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
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate group-hover:text-emerald-400 transition flex items-center gap-2">
                    {f.name}
                    {f.linked_user_id && (
                       <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/30">Linked</span>
                    )}
                  </div>
                  {f.email && <div className="text-xs text-slate-500 truncate">{f.email}</div>}
                </div>
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
                    className="text-slate-400 hover:text-amber-400 text-xs font-medium mr-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditClick(f)
                    }}
                  >
                    Edit
                  </button>
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

