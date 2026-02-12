import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  BanknotesIcon,
  BellIcon // Added
} from '@heroicons/react/24/outline'
import { ExpenseDetailsDialog } from '../components/ExpenseDetailsDialog'
import { getPersonalShare } from '../utils/expenseShare'
import { ExpenseForm } from '../components/ExpenseForm'
import { saveExpense } from '../utils/expenseService'
import type { ExpenseFormState } from '../utils/expenseService'
import { useNotifications } from '../context/NotificationContext' // Added

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
  
  // Enhanced Member Type
  type TripMember = {
    id: string
    trip_id: string
    friend_id: string
    user_id: string | null
    email: string | null
    role: 'admin' | 'viewer' | 'editor' | 'owner'
    friends: { name: string; email?: string } | null
  }

  const [trip, setTrip] = useState<any | null>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [members, setMembers] = useState<TripMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [savingMembers, setSavingMembers] = useState(false)
  
  // New Invite State
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('viewer')

  const { notifications, unreadCount, markAsRead } = useNotifications()
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  // Expense Form State
  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseFormState | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)

  // Derived User Role
  const currentUserRole = useMemo(() => {
    if (!trip || !user) return 'viewer'
    if (trip.user_id === user.id) return 'owner'
    const membership = members.find(m => m.user_id === user.id || m.email === user.email)
    return membership?.role || 'viewer'
  }, [trip, user, members])

  // Portal State
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  
  useEffect(() => {
    setPortalTarget(document.getElementById('trip-header-portal'))
  }, [])
  
  const canEditTrip = currentUserRole === 'owner' || currentUserRole === 'editor' || currentUserRole === 'admin'
  const canAddExpense = canEditTrip //For now admins/editors can add. Viewers cannot.

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

      // Fetch Members with new columns
      const { data: memData, error: memErr } = await supabase
        .from('trip_members')
        .select('*, friends(name, email)')
        .eq('trip_id', id)
      
      if (memErr) throw memErr
      // Explicit cast to avoid type mismatch with 'any' return from Supabase
      setMembers((memData as unknown as TripMember[]) || [])

      // Fetch Expenses
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select('*, expense_splits(*), is_settlement')
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

  const handleInviteMember = async () => {
    if (!id || !user || !inviteEmail) return
    setSavingMembers(true)
    try {
      // 1. Check if friend exists with this email (or name matching email)
      // Since 'friends' table is user-specific, we check only our friends.
      let friendId: string | null = null
      
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('id')
        .eq('email', inviteEmail)
        .eq('user_id', user.id)
        .single()

      if (existingFriend) {
        friendId = existingFriend.id
      } else {
        // Create new friend
        const { data: newFriend, error: createErr } = await supabase
          .from('friends')
          .insert({
            user_id: user.id,
            name: inviteName || inviteEmail.split('@')[0],
            email: inviteEmail
          })
          .select()
          .single()
        
        if (createErr) throw createErr
        friendId = newFriend.id
      }

      // 2. Add to trip_members
      const { error: inviteErr } = await supabase
        .from('trip_members')
        .insert({
          trip_id: id,
          friend_id: friendId,
          email: inviteEmail,
          role: inviteRole
        })

      if (inviteErr) {
        if (inviteErr.code === '23505') alert('This member is already in the trip.')
        else throw inviteErr
      } else {
        setInviteEmail('')
        setInviteName('')
        await fetchTripData()
      }
    } catch (err: any) {
      alert('Failed to invite member: ' + err.message)
    } finally {
      setSavingMembers(false)
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return
    await supabase.from('trip_members').delete().eq('id', memberId)
    await fetchTripData()
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

  const handleRemind = async (friendId: string, amount: number) => {
     // friendId is the ID in memberStats. If it's a friend, we need their user_id to send a notification
     // The 'members' array has { friend_id, user_id, email, ... }
     // memberStats keys are friend_ids (or 'user')
     
     const member = members.find(m => m.friend_id === friendId)
     if (!member || !member.user_id) {
         // If they are just a friend without a linked user_id, we can't notify them in-app?
         // Or maybe we notify via email? For now, alert if no user_id.
         alert("This friend hasn't linked their account, so we can't send an in-app reminder.")
         return
     }

     try {
       await supabase.from('notifications').insert({
         user_id: member.user_id,
         sender_id: user?.id,
         trip_id: id,
         title: `Payment Reminder: ${trip.name}`,
         message: `${user?.user_metadata?.name || 'Your friend'} requested payment of ₹${amount.toFixed(0)}.`,
         type: 'reminder',
         metadata: { amount }
       })
       alert('Reminder sent!')
     } catch (err: any) {
       alert('Failed to send reminder: ' + err.message)
     }
  }

  const handleSettleUp = async (friendId: string, amount: number) => {
    if (!confirm(`Mark ₹${amount.toFixed(0)} as paid to this friend?`)) return
    
    // Create a settlement expense
    // Payer: Me (user.id)
    // Split: Friend (100%)
    // But wait, if I pay THEM, I am the payer, and they are the one benefiting?
    // Expense logic:
    // User pays $50. User paid $50.
    // If it's for Friend, Friend owes $50.
    // This increases Friend's debt to User.
    // Wait. "Settle Up" usually means paying off a debt.
    // If I owe Friend $50. I pay Friend $50.
    // In Splitwise: "Record a payment". Payer: Me. Paid to: Friend.
    // This removes the debt.
    // 
    // In our system:
    // I owe Friend $50 means Friend paid for me previously.
    // Friend paid $50, split with Me (100% or 50/50). My balance is negative.
    // To settle, I pay $50. 
    // Who pays? Me.
    // Who is it for? Friend? No.
    // If I pay $50 and say it's for Friend, Friend "owes" me $50.
    // My balance = +50 (paid) - 0 (share). = +50.
    // Friend balance = 0 (paid) - 50 (share). = -50.
    // Net result: I am +50, Friend is -50.
    // If previously I was -50 and Friend was +50.
    // Now I am (-50 + 50) = 0. Friend is (+50 - 50) = 0.
    // YES.
    // So "Settle Up" where "I pay Friend" means:
    // Expense: Amount $50. Payer: Me. Split: Friend (100%).
    // Checks out.

    try {
        const settlementData: ExpenseFormState = {
            amount: String(amount),
            currency: 'INR',
            date: new Date().toISOString(),
            category_id: '', // Special category or null
            title: 'Settlement',
            note: '',
            is_recurring: false,
            splitEvenly: false,
            isSplit: true,
            includeUser: false, // I am paying, but it is FOR them (they get the value/cash)
            payerId: 'you', // I paid
            friendIds: [friendId], // For them
            trip_id: id!,
            payment_mode: 'online',
            is_settlement: true
        }
        
        // We need to construct the splits manually because saveExpense handles logic
        // But saveExpense expects friendIds and does the splitting logic.
        // If includeUser is false, and friendIds has 1 person. 100% goes to that friend.
        // Correct.
        
        await saveExpense(settlementData, user!.id)
        
        // Also notify them?
        const member = members.find(m => m.friend_id === friendId)
        if (member?.user_id) {
             await supabase.from('notifications').insert({
                user_id: member.user_id,
                sender_id: user?.id,
                trip_id: id,
                title: `Settlement Received`,
                message: `${user?.user_metadata?.name || 'Friend'} recorded a payment of ₹${amount.toFixed(0)} to you.`,
                type: 'settlement',
                metadata: { amount }
             })
        }
        
        await fetchTripData()
    } catch (err: any) {
        alert('Failed to settle: ' + err.message)
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

    const results: { from: string; fromId: string; to: string; toId: string; amount: number }[] = []

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
          fromId: debtor.id,
          to: creditor.name,
          toId: creditor.id,
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
      <header className="flex items-center gap-4 pt-14 md:pt-0 justify-between">
        <div className="flex items-center gap-4">
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
        </div>
        {/* Mobile Sidebar Toggle is in AppLayout, we just show content */}
        <div></div> {/* Spacer */}
      </header>
      
      {/* Portal to AppLayout Header */}
      {portalTarget && createPortal(
        <div className="flex items-center gap-3">
          {canAddExpense && (
            <>
              <button
                onClick={() => {
                  setEditingExpense(undefined)
                  setFormOpen(true)
                }}
                className="hidden sm:flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-sm font-semibold transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Expense
              </button>
              <button
                 onClick={() => {
                     setEditingExpense(undefined)
                     setFormOpen(true)
                 }}
                 className="sm:hidden flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 w-8 h-8 rounded-full text-sm font-semibold transition"
                 aria-label="Add Trip Expense"
             >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                 </svg>
             </button>
            </>
          )}

          <div className="relative">
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 transition relative"
            >
              <BellIcon className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                 <div className="p-3 border-b border-slate-800 bg-slate-800/50">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notifications</h4>
                 </div>
                 <div className="max-h-80 overflow-y-auto">
                   {notifications.length === 0 ? (
                     <div className="p-6 text-center text-slate-500 text-sm">No notifications</div>
                   ) : (
                     notifications.map(n => (
                       <div 
                         key={n.id} 
                         className={`p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition text-sm ${!n.is_read ? 'bg-slate-800/10' : ''}`}
                         onClick={() => markAsRead(n.id)}
                       >
                         <div className="font-semibold text-slate-200">{n.title}</div>
                         <div className="text-slate-400 mt-1">{n.message}</div>
                         <div className="text-[10px] text-slate-600 mt-2 text-right">
                           {new Date(n.created_at).toLocaleString()}
                         </div>
                       </div>
                     ))
                   )}
                 </div>
              </div>
            )}
          </div>
        </div>,
        portalTarget
      )}

      
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
            canAdd={canAddExpense}
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
            onRemind={handleRemind}
            onSettle={handleSettleUp}
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Manage Trip Members</h3>
              <button onClick={() => setMemberModalOpen(false)} className="text-slate-400 hover:text-slate-200 text-xl transition">&times;</button>
            </div>
            
            <div className="p-6 space-y-6">
               {/* Invite Section */}
               {canEditTrip && (
                 <div className="bg-slate-800/50 p-4 rounded-xl space-y-3">
                   <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Invite New Member</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <input 
                       type="email" 
                       placeholder="Email Address"
                       value={inviteEmail}
                       onChange={e => setInviteEmail(e.target.value)}
                       className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-sky-500/50 outline-none"
                     />
                     <input 
                       type="text" 
                       placeholder="Name (Optional)"
                       value={inviteName}
                       onChange={e => setInviteName(e.target.value)}
                       className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-sky-500/50 outline-none"
                     />
                   </div>
                   <div className="flex items-center gap-3">
                     <select 
                       value={inviteRole}
                       onChange={(e) => setInviteRole(e.target.value as 'admin' | 'viewer')}
                       className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400 focus:ring-2 focus:ring-sky-500/50 outline-none"
                     >
                       <option value="viewer">Viewer (Read Only)</option>
                       <option value="admin">Admin (Can Edit)</option>
                     </select>
                     <button 
                       onClick={handleInviteMember}
                       disabled={!inviteEmail || savingMembers}
                       className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-2 rounded-lg text-sm transition"
                     >
                       {savingMembers ? 'Sending...' : 'Send Invite'}
                     </button>
                   </div>
                 </div>
               )}

               {/* Member List */}
               <div>
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Current Members ({members.length})</h4>
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-800">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {(member.friends?.name || 'U').charAt(0).toUpperCase()}
                           </div>
                           <div>
                             <div className="text-sm font-medium text-slate-200">{member.friends?.name || 'Unknown'}</div>
                             <div className="text-[10px] text-slate-500 flex items-center gap-2">
                               {member.email}
                               <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${member.role === 'admin' || member.role === 'owner' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-700 text-slate-400'}`}>
                                 {member.role || 'viewer'}
                               </span>
                             </div>
                           </div>
                        </div>
                        {canEditTrip && member.user_id !== user?.id && (
                          <button 
                            onClick={() => removeMember(member.id)}
                            className="text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition"
                            title="Remove Member"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                 </div>
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
