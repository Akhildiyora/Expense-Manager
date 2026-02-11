
import React, { useEffect, useMemo, useState } from 'react'
import { useExpenses, type Expense } from '../queries/useExpenses'
import { useCategories } from '../queries/useCategories'
import { useFriends } from '../queries/useFriends'
import { useTrips } from '../queries/useTrips'
import { useAuth } from '../auth/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { Select } from '../components/Select'
import { ExpenseDetailsDialog } from '../components/ExpenseDetailsDialog'
import { getPersonalShare } from '../utils/expenseShare'
import { ExpenseForm } from '../components/ExpenseForm'
import type { ExpenseFormState } from '../utils/expenseService'
import { saveExpense } from '../utils/expenseService'
import { supabase } from '../supabaseClient'

const ExpensesPage: React.FC = () => {
  const [filters, setFilters] = useState<{ 
    fromDate?: string; 
    toDate?: string; 
    categoryId?: string; 
    paymentMode?: 'cash' | 'online' | 'card';
    search?: string;
    sortBy?: 'date' | 'amount';
    sortOrder?: 'asc' | 'desc';
  }>({})
  // No longer strictly separating: fetch ALL personal expenses, including trip ones.
  const { expenses, loading, error, setExpenses } = useExpenses({ ...filters })
  const { trips } = useTrips()
  const { categories, getCategoriesWithSubcategories } = useCategories()
  const { friends } = useFriends()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseFormState | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)
  
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + getPersonalShare(e), 0),
    [expenses],
  )

  const startCreate = () => {
    setEditingExpense(undefined)
    setFormOpen(true)
    setFormError(null)
  }

  useEffect(() => {
    if (loading) return

    const newParam = searchParams.get('new')
    const editId = searchParams.get('edit')

    if (newParam === '1' && !formOpen) {
      startCreate()
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('new')
        return next
      })
    } else if (editId && !formOpen) {
      const expenseExists = expenses.find(e => e.id === editId)
      if (expenseExists) {
        startEdit(editId)
        setSearchParams((current) => {
          const next = new URLSearchParams(current)
          next.delete('edit')
          return next
        })
      }
    }
  }, [searchParams, formOpen, setSearchParams, loading, expenses])

  const startEdit = (id: string) => {
    const existing = expenses.find((e) => e.id === id)
    if (!existing) return

    // Reconstruct split logic
    const splits = (existing as Expense).expense_splits || []
    const isSplit = splits.length > 0
    let friendIds: string[] = []
    let includeUser = true

    if (isSplit) {
      const participants = new Set<string>()
      splits.forEach((s) => {
        if (s.friend_id) participants.add(s.friend_id)
      })
      friendIds = Array.from(participants)

      if (existing.payer_id) {
        includeUser = splits.some((s) => s.friend_id === null)
      } else {
        const totalConf = Number(existing.amount)
        const totalShares = splits.reduce((sum, s) => sum + Number(s.share_amount), 0)
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
      trip_id: existing.trip_id ?? null,
      payment_mode: existing.payment_mode || 'online',
    })
    setFormOpen(true)
  }

  const handleFormSubmit = async (data: ExpenseFormState) => {
     if (!user) return
     try {
        await saveExpense(data, user.id)
        
        // Refresh
        // Refresh ALL relevant expenses
        const { data: refreshed, error: refreshError } = await supabase
            .from('expenses')
            .select('*, expense_splits(*)')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })

        if (refreshError) throw refreshError
        setExpenses(refreshed ?? [])
        
        setFormOpen(false)
        setEditingExpense(undefined)
     } catch (err: any) {
         setFormError(err.message)
         // Keep form open
         throw err // propagate to form if needed? 
         // Actually ExpenseForm doesn't handle error, so we might need to show it here or pass it down.
         // For now, simple alert or logging.
         alert('Failed to save: ' + err.message)
     }
  }

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this expense?')
    if (!ok) return
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(expenses.filter((e) => e.id !== id))
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized'

    const category = categories.find((c) => c.id === categoryId)
    if (!category) return 'Unknown'

    if (!category.parent_id) {
      return category.name
    }

    const parentCategory = categories.find((c) => c.id === category.parent_id)
    return parentCategory ? `${parentCategory.name} > ${category.name}` : category.name
  }

  const getPayerName = (payerId: string | null) =>
    payerId
      ? friends.find((f) => f.id === payerId)?.name ?? 'Unknown'
      : 'You'

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-14 md:pt-0">
        <div>
          <h2 className="text-xl font-semibold">Expenses</h2>
          <p className="text-sm text-slate-400">
            Track, filter, and manage your spending.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition"
        >
          Add expense
        </button>
      </header>

      {formError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
          {formError}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-4">

           {/* Top Row: Search and Quick Sort */}
           <div className="flex gap-3">
              <input 
                type="text"
                placeholder="Search expenses..."
                value={filters.search || ''}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value || undefined }))}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <div className="w-48">
                <Select
                  value={`${filters.sortBy || 'date'}-${filters.sortOrder || 'desc'}`}
                  onChange={(val) => {
                     const [sortBy, sortOrder] = val.split('-') as ['date' | 'amount', 'asc' | 'desc']
                     setFilters(f => ({ ...f, sortBy, sortOrder }))
                  }}
                  options={[
                    { value: 'date-desc', label: 'Date (Newest)' },
                    { value: 'date-asc', label: 'Date (Oldest)' },
                    { value: 'amount-desc', label: 'Amount (High to Low)' },
                    { value: 'amount-asc', label: 'Amount (Low to High)' },
                  ]}
                  placeholder="Sort by"
                />
              </div>
           </div>

           {/* Bottom Row: Detailed Filters */}
           <div className="flex flex-wrap gap-3 items-end">
             {/* Date inputs remain native for now as they are specific types */}
             <div>
               <label className="block text-[11px] mb-1 text-slate-400">From date</label>
               <input
                 type="date"
                 value={filters.fromDate ?? ''}
                 onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value || undefined }))}
                 className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-[42px]"
               />
             </div>
             <div>
               <label className="block text-[11px] mb-1 text-slate-400">To date</label>
               <input
                 type="date"
                 value={filters.toDate ?? ''}
                 onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value || undefined }))}
                 className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-[42px]"
               />
             </div>
             <div className="min-w-[180px]">
               <label className="block text-[11px] mb-1 text-slate-400">Category</label>
               <Select
                 value={filters.categoryId ?? ''}
                 onChange={(val) => setFilters(f => ({ ...f, categoryId: val || undefined }))}
                 options={[
                   { value: '', label: 'All Categories' },
                   ...getCategoriesWithSubcategories().flatMap(main => [
                     { value: main.id, label: main.name },
                     ...main.subcategories.map(sub => ({ value: sub.id, label: `  ${sub.name}` }))
                   ])
                 ]}
                 placeholder="All Categories"
               />
             </div>
             <div className="min-w-[140px]">
               <label className="block text-[11px] mb-1 text-slate-400">Payment Mode</label>
               <Select
                 value={filters.paymentMode ?? ''}
                 onChange={(val) => setFilters(f => ({ ...f, paymentMode: (val as 'cash' | 'online' | 'card') || undefined }))}
                 options={[
                   { value: '', label: 'All Modes' },
                   { value: 'online', label: 'Online' },
                   { value: 'cash', label: 'Cash' },
                   { value: 'card', label: 'Card' },
                 ]}
                 placeholder="All Modes"
               />
             </div>

             <div className="ml-auto text-right pb-1">
               <p className="text-[11px] text-slate-400">Total</p>
               <p className="text-sm font-bold text-emerald-400">₹{total.toFixed(2)}</p>
             </div>
           </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
        <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400 flex min-w-[520px]">
          <div className="w-24 sm:w-28 shrink-0">Date</div>
          <div className="flex-1 min-w-[80px]">Title</div>
          <div className="w-32 sm:w-48 shrink-0">Category</div>
          <div className="w-20 sm:w-28 shrink-0 hidden sm:block">Paid by</div>
          <div className="w-20 sm:w-24 shrink-0 text-right">Amount</div>
          <div className="w-20 shrink-0 text-right">Actions</div>
        </div>
        {loading && (
          <div className="px-4 py-4 text-xs text-slate-400">Loading expenses…</div>
        )}
        {error && (
          <div className="px-4 py-4 text-xs text-red-400">Error: {error}</div>
        )}
        {!loading && expenses.length === 0 && !error && (
          <div className="px-4 py-4 text-xs text-slate-400">
            No expenses yet. Add your first one.
          </div>
        )}
        <ul className="divide-y divide-slate-800 min-w-[520px]">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="px-4 py-2 text-xs text-slate-200 flex items-center hover:bg-slate-800/50 cursor-pointer transition-colors"
              onClick={() => setSelectedExpenseId(e.id)}
            >
              <div className="w-24 sm:w-28 shrink-0 text-slate-400">{e.date}</div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="truncate">{e.title}</div>
                {e.trip_id && (
                  <div className="text-[10px] text-sky-400 font-medium truncate">
                    Trip: {trips.find(t => t.id === e.trip_id)?.name || 'Linked Trip'}
                  </div>
                )}
              </div>
              <div className="w-32 sm:w-48 shrink-0 text-slate-300 truncate">
                {getCategoryName(e.category_id)}
              </div>
              <div className="w-20 sm:w-28 shrink-0 text-slate-300 hidden sm:block truncate">{getPayerName(e.payer_id)}</div>
              <div className="w-20 sm:w-24 shrink-0 text-right">
                <div className="text-emerald-400 font-bold">₹{getPersonalShare(e).toFixed(2)}</div>
                {getPersonalShare(e) !== Number(e.amount) && (
                  <div className="text-[10px] text-slate-500">of ₹{Number(e.amount).toFixed(2)}</div>
                )}
              </div>
              <div className="w-20 shrink-0 text-right space-x-2">
                <button
                  type="button"
                  className="text-emerald-400 hover:text-emerald-300"
                  onClick={(event) => {
                    event.stopPropagation()
                    startEdit(e.id)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-red-400 hover:text-red-300"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDelete(e.id)
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Transaction Details Dialog */}
      <ExpenseDetailsDialog
        isOpen={!!selectedExpenseId}
        onClose={() => setSelectedExpenseId(null)}
        expense={expenses.find((e) => e.id === selectedExpenseId) ?? null}
        categoryName={selectedExpenseId ? getCategoryName(expenses.find(e => e.id === selectedExpenseId)?.category_id ?? null) : ''}
        payerName={selectedExpenseId ? getPayerName(expenses.find(e => e.id === selectedExpenseId)?.payer_id ?? null) : ''}
        onEdit={(id) => {
          setSelectedExpenseId(null)
          startEdit(id)
        }}
        onDelete={(id) => {
            setSelectedExpenseId(null)
            void handleDelete(id)
        }}
      />

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
                {editingExpense ? 'Edit expense' : 'Add expense'}
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
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpensesPage
