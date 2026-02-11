import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'
import { useFriends } from '../queries/useFriends'
import { useCategories } from '../queries/useCategories'
import {
  ArrowLeftIcon,
  CalendarIcon,
  UserGroupIcon,
  ExclamationCircleIcon,
  Squares2X2Icon,
  QueueListIcon,
  ChartPieIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'
import { ExpenseDetailsDialog } from '../components/ExpenseDetailsDialog'
import { getPersonalShare } from '../utils/expenseShare'
import { ExpenseForm } from '../components/ExpenseForm'
import { saveExpense } from '../utils/expenseService'
import type { ExpenseFormState } from '../utils/expenseService'

// Sub-components
import { TripDashboard } from '../components/trip/TripDashboard'
import { TripExpenses } from '../components/trip/TripExpenses'
import { TripAnalysis } from '../components/trip/TripAnalysis'
import { TripSettlements } from '../components/trip/TripSettlements'

type Tab = 'dashboard' | 'expenses' | 'analysis' | 'settlements'

const TripDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { friends } = useFriends()
  const { categories } = useCategories()
  
  const [trip, setTrip] = useState<any | null>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [savingMembers, setSavingMembers] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  // Expense Form State
  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseFormState | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchTripData = async () => {
    if (!id || !user) return
    try {
      // Fetch Trip
      const { data: tripData, error: tripErr } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single()
      if (tripErr) throw tripErr
      setTrip(tripData)

      // Fetch Members
      const { data: memData, error: memErr } = await supabase
        .from('trip_members')
        .select('friend_id, friends(name)')
        .eq('trip_id', id)
      
      if (memErr) throw memErr
      const currentMembers = memData || []
      setMembers(currentMembers)
      setSelectedMemberIds(currentMembers.map(m => m.friend_id))

      // Fetch Expenses
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select('*, expense_splits(*)')
        .eq('trip_id', id)
        .order('date', { ascending: false })
      if (expErr) throw expErr
      setExpenses(expData || [])

    } catch (err) {
      console.error('Failed to load trip details:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchTripData()
  }, [id, user])

  const handleSaveMembers = async () => {
    if (!id) return
    setSavingMembers(true)
    try {
      // 1. Delete all existing members
      await supabase.from('trip_members').delete().eq('trip_id', id)

      // 2. Insert new member set
      if (selectedMemberIds.length > 0) {
        const rows = selectedMemberIds.map(fid => ({
          trip_id: id,
          friend_id: fid
        }))
        const { error: insErr } = await supabase.from('trip_members').insert(rows)
        if (insErr) throw insErr
      }

      await fetchTripData()
      setMemberModalOpen(false)
    } catch (err: any) {
      alert(err.message || 'Failed to update members')
    } finally {
      setSavingMembers(false)
    }
  }

  const handleFormSubmit = async (data: ExpenseFormState) => {
    if (!user || !id) return
    try {
        // Ensure trip_id is set to current trip
        const dataWithTrip = { ...data, trip_id: id }
        await saveExpense(dataWithTrip, user.id)
        await fetchTripData()
        setFormOpen(false)
        setEditingExpense(undefined)
    } catch (err: any) {
        setFormError(err.message)
        alert('Failed to save: ' + err.message)
    }
  }

  const startEdit = (expenseId: string) => {
    const existing = expenses.find((e) => e.id === expenseId)
    if (!existing) return

    // Reconstruct split logic
    const splits = (existing as any).expense_splits || []
    const isSplit = splits.length > 0
    let friendIds: string[] = []
    let includeUser = true

    if (isSplit) {
      const participants = new Set<string>()
      splits.forEach((s: any) => {
        if (s.friend_id) participants.add(s.friend_id)
      })
      friendIds = Array.from(participants)

      if (existing.payer_id) {
        includeUser = splits.some((s: { friend_id: string | null }) => s.friend_id === null)
      } else {
        const totalConf = Number(existing.amount)
        const totalShares = splits.reduce((sum: number, s: { share_amount: number }) => sum + Number(s.share_amount), 0)
        // Approximate check
        if (Math.abs(totalConf - totalShares) < 0.05) {
          includeUser = false
        } else {
          includeUser = true
        }
      }
    } else {
        friendIds = []
        includeUser = true
    }

    setEditingExpense({
      id: existing.id,
      amount: String(existing.amount),
      currency: existing.currency,
      date: existing.date,
      category_id: existing.category_id ?? '',
      title: existing.title,
      note: existing.note ?? '',
      is_recurring: existing.is_recurring,
      recurring_frequency: (existing as any).recurring_frequency ?? 'monthly',
      friendIds,
      splitEvenly: true,
      isSplit,
      includeUser,
      payerId: existing.payer_id ?? 'you',
      trip_id: id ?? null, // Force current trip ID
      payment_mode: existing.payment_mode || 'online',
    })
    setFormOpen(true)
  }

  const tripTotal = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount), 0), [expenses])
  const personalTotal = useMemo(() => expenses.reduce((sum, e) => sum + getPersonalShare(e), 0), [expenses])

  const memberStats = useMemo(() => {
    const stats: Record<string, { name: string; paid: number; share: number; balance: number }> = {}
    
    // User stats
    stats['user'] = { name: 'You', paid: 0, share: 0, balance: 0 }

    // Friend stats
    members.forEach(m => {
      stats[m.friend_id] = { name: m.friends?.name || 'Unknown', paid: 0, share: 0, balance: 0 }
    })

    expenses.forEach(e => {
      const amount = Number(e.amount)
      // Check who paid
      if (e.payer_id === null) {
        stats['user'].paid += amount
      } else if (stats[e.payer_id]) {
        stats[e.payer_id].paid += amount
      }
      
      // Process splits to calculate shares
      const splits = e.expense_splits || []
      splits.forEach((s: { friend_id: string | null; share_amount: number }) => {
        const share = Number(s.share_amount)
        if (s.friend_id === null) {
          stats['user'].share += share
        } else if (stats[s.friend_id]) {
          stats[s.friend_id].share += share
        }
      })
    })

    // Final balance calculation
    Object.keys(stats).forEach(id => {
      stats[id].balance = stats[id].paid - stats[id].share
    })

    return stats
  }, [members, expenses])

  const settlements = useMemo(() => {
    const participants = Object.entries(memberStats).map(([id, s]) => ({
      id,
      name: s.name,
      balance: s.balance
    }))

    const debtors = participants.filter(p => p.balance < -0.01).sort((a, b) => a.balance - b.balance)
    const creditors = participants.filter(p => p.balance > 0.01).sort((a, b) => b.balance - a.balance)

    const results: { from: string; to: string; amount: number }[] = []

    let dIdx = 0
    let cIdx = 0

    const dBalances = debtors.map(d => ({ ...d }))
    const cBalances = creditors.map(c => ({ ...c }))

    while (dIdx < dBalances.length && cIdx < cBalances.length) {
      const debtor = dBalances[dIdx]
      const creditor = cBalances[cIdx]

      const amount = Math.min(Math.abs(debtor.balance), creditor.balance)
      if (amount > 0.01) {
        results.push({
          from: debtor.name,
          to: creditor.name,
          amount: amount
        })
      }

      debtor.balance += amount
      creditor.balance -= amount

      if (Math.abs(debtor.balance) < 0.01) dIdx++
      if (Math.abs(creditor.balance) < 0.01) cIdx++
    }

    return results
  }, [memberStats])

  if (loading) return <div className="p-8 text-center text-slate-500">Loading trip details...</div>
  if (!trip) return (
    <div className="p-8 text-center text-slate-400">
      <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
      <p>Trip not found.</p>
      <button onClick={() => navigate('/app/trips')} className="mt-4 text-sky-400">Back to Trips</button>
    </div>
  )

  const budgetUsed = trip.budget ? (tripTotal / Number(trip.budget)) * 100 : 0
  const isOverBudget = trip.budget && tripTotal > Number(trip.budget)

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-center gap-4 pt-14 md:pt-0">
        <button onClick={() => navigate('/app/trips')} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 transition">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">{trip.name}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
             <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> {trip.start_date || 'N/A'} - {trip.end_date || 'N/A'}</span>
             <span>•</span>
             <span className="flex items-center gap-1"><UserGroupIcon className="w-4 h-4" /> {members.length} Members</span>
          </div>
        </div>
      </header>
      
      {formError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6">
          {formError}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-6 text-sm overflow-x-auto">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'dashboard' ? 'text-sky-400 border-b-2 border-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Squares2X2Icon className="w-4 h-4" /> Overview
        </button>
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'expenses' ? 'text-sky-400 border-b-2 border-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'}`}
        >
           <QueueListIcon className="w-4 h-4" /> Expenses ({expenses.length})
        </button>
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`pb-3 flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'analysis' ? 'text-sky-400 border-b-2 border-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'}`}
        >
           <ChartPieIcon className="w-4 h-4" /> Analysis
        </button>
        <button 
          onClick={() => setActiveTab('settlements')}
          className={`pb-3 flex items-center gap-2 transition whitespace-nowrap ${activeTab === 'settlements' ? 'text-sky-400 border-b-2 border-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'}`}
        >
           <BanknotesIcon className="w-4 h-4" /> Settlements
        </button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'dashboard' && (
          <TripDashboard 
            trip={trip}
            members={members}
            expenses={expenses}
            categories={categories}
            tripTotal={tripTotal}
            personalTotal={personalTotal}
            budgetUsed={budgetUsed}
            isOverBudget={isOverBudget}
          />
        )}

        {activeTab === 'expenses' && (
          <TripExpenses 
            expenses={expenses}
            friends={friends}
            onAddExpense={() => {
              setEditingExpense(undefined)
              setFormOpen(true)
            }}
            onSelectExpense={setSelectedExpenseId}
          />
        )}

        {activeTab === 'analysis' && (
          <TripAnalysis
            expenses={expenses}
            categories={categories}
            tripTotal={tripTotal}
          />
        )}

        {activeTab === 'settlements' && (
          <TripSettlements 
            memberStats={memberStats}
            settlements={settlements}
            onManageMembers={() => setMemberModalOpen(true)}
          />
        )}
      </div>

      <ExpenseDetailsDialog
        isOpen={!!selectedExpenseId}
        onClose={() => setSelectedExpenseId(null)}
        expense={expenses.find(e => e.id === selectedExpenseId) || null}
        categoryName={selectedExpenseId ? (categories.find(c => c.id === expenses.find(e => e.id === selectedExpenseId)?.category_id)?.name || 'Uncategorized') : ''}
        payerName={selectedExpenseId ? (expenses.find(e => e.id === selectedExpenseId)?.payer_id ? friends.find(f => f.id === expenses.find(e => e.id === selectedExpenseId)?.payer_id)?.name || 'Friend' : 'You') : ''}
        onEdit={(id) => {
          setSelectedExpenseId(null)
          startEdit(id)
        }}
        onDelete={async (id) => {
          if (window.confirm('Delete this expense?')) {
            await supabase.from('expenses').delete().eq('id', id)
            setExpenses(prev => prev.filter(e => e.id !== id))
            await fetchTripData() // Refresh sums
          }
        }}
      />

      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Manage Trip Members</h3>
              <button onClick={() => setMemberModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-xl transition">&times;</button>
            </div>
            <div className="p-5">
               <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar mb-6">
                  {friends.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4 italic">No friends found. Add friends first.</p>
                  ) : (
                    friends.map(friend => (
                      <label key={friend.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/50 cursor-pointer transition border border-transparent hover:border-slate-700">
                        <input 
                          type="checkbox"
                          checked={selectedMemberIds.includes(friend.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMemberIds(prev => [...prev, friend.id])
                            else setSelectedMemberIds(prev => prev.filter(mid => mid !== friend.id))
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-sky-500/50"
                        />
                        <span className="text-sm text-slate-300 font-medium">{friend.name}</span>
                      </label>
                    ))
                  )}
               </div>
               <div className="flex gap-3">
                 <button 
                   onClick={() => setMemberModalOpen(false)}
                   className="flex-1 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition uppercase tracking-wider"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleSaveMembers}
                   disabled={savingMembers}
                   className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-sky-900/20 transition disabled:opacity-50 uppercase tracking-wider"
                 >
                   {savingMembers ? 'Saving...' : 'Save Changes'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setFormOpen(false)
              setEditingExpense(undefined)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/40 max-h-[90vh] overflow-hidden flex flex-col min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-50">
                {editingExpense ? 'Edit trip expense' : 'Add trip expense'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false)
                  setEditingExpense(undefined)
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <ExpenseForm 
                initialData={editingExpense}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                    setFormOpen(false)
                    setEditingExpense(undefined)
                }}
                showTripSelect={false}
                tripId={id}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default TripDetailsPage
