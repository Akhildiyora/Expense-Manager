import React, { useState } from 'react'
import { useBudgets } from '../queries/useBudgets'
import { useCategories } from '../queries/useCategories'
import { useExpenses, type Expense } from '../queries/useExpenses'
import { useFriends } from '../queries/useFriends'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'
import {
  ChartBarIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  BanknotesIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import type { Budget } from '../queries/useBudgets'
import { ExpenseDetailsDialog } from '../components/ExpenseDetailsDialog'
import { Select } from '../components/Select'
import { getPersonalShare } from '../utils/expenseShare'

const BudgetsPage: React.FC = () => {
  const { budgets, loading, error, setBudgets } = useBudgets()
  const { categories, getSubcategories } = useCategories()
  const { expenses } = useExpenses()
  const { friends } = useFriends()
  const { user } = useAuth()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    id: '',
    category_id: '',
    period: 'monthly',
    amount: '',
  })
  const [saving, setSaving] = useState(false)
  const [viewBudget, setViewBudget] = useState<Budget | null>(null)
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState<Expense | null>(null)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'default' | 'amount-high' | 'amount-low' | 'usage-high' | 'usage-low'>('default')

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Overall Budget'
    const category = categories.find((c) => c.id === categoryId)
    if (!category) return 'Unknown Category'

    if (!category.parent_id) {
      return category.name
    }

    const parent = categories.find((c) => c.id === category.parent_id)
    return parent ? `${parent.name} > ${category.name}` : category.name
  }

  const getPayerName = (payerId: string | null) =>
    payerId ? friends.find((f) => f.id === payerId)?.name ?? 'Unknown' : 'You'

  const filteredBudgets = React.useMemo(() => {
    let result = [...budgets]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b => {
        const catName = getCategoryName(b.category_id).toLowerCase()
        return catName.includes(q)
      })
    }

    if (sortBy !== 'default') {
      result.sort((a, b) => {
        if (sortBy.startsWith('amount')) {
           const diff = Number(a.amount) - Number(b.amount)
           return sortBy === 'amount-high' ? -diff : diff
        } else {
           // efficient usage calculation for sorting
           const getUsage = (budget: Budget) => {
              const spent = getSpent(budget.category_id)
              const limit = Number(budget.amount)
              return limit > 0 ? (spent / limit) : 0
           }
           const diff = getUsage(a) - getUsage(b)
           return sortBy === 'usage-high' ? -diff : diff
        }
      })
    }

    return result
  }, [budgets, search, sortBy, expenses, categories]) // dependent on getSpent -> spendingMap which is derived from expenses on render. 
  // Ideally getSpent should be memoized or spendingMap should be.
  // Since spendingMap is computed in render body (lines 42-53), we need to check if that's safe.
  // It is computed *before* this useMemo, so it's available in scope. 
  // However, `getSpent` function is also defined in render body.
  // We can use them inside useMemo if we include them in dependency or just rely on them being available in closure (but that's tricky with stale closures if dependencies aren't right).
  // Actually, standard React rule: if using variables from render scope, include them in dependency array.
  // `getSpent` changes on every render because it's defined in render.
  // This will cause `filteredBudgets` to re-compute on every render, which is fine for this app scale.

  // Calculate spending per category for the current month
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const spendingMap = new Map<string, number>()
  let totalMonthlySpending = 0

  expenses.forEach((e) => {
    if (e.date.startsWith(currentMonth)) {
      const amt = getPersonalShare(e)
      totalMonthlySpending += amt
      if (e.category_id) {
        spendingMap.set(e.category_id, (spendingMap.get(e.category_id) ?? 0) + amt)
      }
    }
  })

  // Helper to get spent amount for a budget
  const getSpent = (categoryId: string | null) => {
    if (!categoryId) return totalMonthlySpending // Overall budget
    
    let total = spendingMap.get(categoryId) ?? 0
    
    // Add subcategories
    const subs = getSubcategories(categoryId)
    subs.forEach(sub => {
        total += spendingMap.get(sub.id) ?? 0
    })
    
    return total
  }

  const getBudgetExpenses = (budget: Budget) => {
    const budgetCategory = budget.category_id
    const subs = budgetCategory ? getSubcategories(budgetCategory).map(s => s.id) : []
    const allCategoryIds = budgetCategory ? [budgetCategory, ...subs] : []

    return expenses
      .filter((e) => {
        // Filter by date (current month)
        if (!e.date.startsWith(currentMonth)) return false
        
        // Filter by category
        if (!budgetCategory) return true // Overall budget includes everything
        
        return e.category_id && allCategoryIds.includes(e.category_id)
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const startEdit = (id: string) => {
    const existing = budgets.find((b) => b.id === id)
    if (!existing) return
    setForm({
      id: existing.id,
      category_id: existing.category_id ?? '',
      period: existing.period,
      amount: String(existing.amount),
    })
    setFormOpen(true)
  }

  const resetForm = () => {
    setForm({
      id: '',
      category_id: '',
      period: 'monthly',
      amount: '',
    })
    setFormOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount) return
    if (!user) return
    setSaving(true)

    const payload = {
      category_id: form.category_id || null,
      period: form.period,
      amount: Number(form.amount),
    }

    if (form.id) {
      const { data, error: updateError } = await supabase
        .from('budgets')
        .update(payload)
        .eq('id', form.id)
        .select()
        .single()
      setSaving(false)
      if (updateError) return
      setBudgets(budgets.map((b) => (b.id === form.id ? (data as Budget) : b)))
    } else {
      const { data, error: insertError } = await supabase
        .from('budgets')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single()
      setSaving(false)
      if (insertError) return
      setBudgets([data as Budget, ...budgets])
    }

    resetForm()
  }

  const handleDelete = async (id: string) => {

    const ok = window.confirm('Delete this budget?')
    if (!ok) return
    await supabase.from('budgets').delete().eq('id', id)
    setBudgets(budgets.filter((b) => b.id !== id))
    if (form.id === id) resetForm()
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center justify-between pt-14 md:pt-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ChartBarIcon className="w-6 h-6 text-emerald-400" />
            Budgets
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Track your spending limits for the current month.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setFormOpen(true)
          }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-emerald-900/20"
        >
          <PlusIcon className="w-4 h-4" />
          Set Budget
        </button>
      </header>

      {loading && <div className="text-center text-slate-500 py-10">Loading budgets...</div>}
      {error && <div className="text-red-400 bg-red-950/20 p-4 rounded-xl">Error: {error}</div>}

      {!loading && !error && budgets.length === 0 && (
        <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-slate-800/50 border-dashed">
          <ChartBarIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-base">No budgets set yet.</p>
          <button
            onClick={() => setFormOpen(true)}
            className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
          >
            Create your first budget
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-2 rounded-2xl border border-slate-800/50">
         <input 
            type="text"
            placeholder="Search budgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
         />
         <div className="w-full sm:w-56">
            <Select
               value={sortBy}
               onChange={(val) => setSortBy(val as 'default' | 'amount-high' | 'amount-low' | 'usage-high' | 'usage-low')}
               options={[
                  { value: 'default', label: 'Default' },
                  { value: 'amount-high', label: 'Limit (High-Low)' },
                  { value: 'amount-low', label: 'Limit (Low-High)' },
                  { value: 'usage-high', label: '% Used (High-Low)' },
                  { value: 'usage-low', label: '% Used (Low-High)' },
               ]}
               placeholder="Sort by"
            />
         </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBudgets.map((budget) => {
          const spent = getSpent(budget.category_id)
          const limit = Number(budget.amount)
          const percentage = Math.min(100, (spent / limit) * 100)
          const isOver = spent > limit
          const colorClass = isOver ? 'bg-red-500' : percentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'
          const textColorClass = isOver ? 'text-red-400' : percentage > 80 ? 'text-amber-400' : 'text-emerald-400'

          return (
            <div
              key={budget.id}
              onClick={() => setViewBudget(budget)}
              className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-slate-700/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-1000"></div>

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="text-lg font-semibold text-slate-200">
                    {getCategoryName(budget.category_id)}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mt-0.5">
                    {budget.period}
                  </p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(budget.id)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/30 transition"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(budget.id)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 relative z-10">
                <div className="flex justify-end gap-1 items-end">
                  <span className={`text-2xl font-bold ${textColorClass}`}>
                    ₹{spent.toFixed(0)}
                  </span>
                  <span className="text-sm text-slate-400 pb-1">
                    / ₹{limit.toFixed(0)}
                  </span>
                </div>

                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colorClass} transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 font-medium pt-1">
                  <span>{percentage.toFixed(0)}% used</span>
                  <span>{isOver ? `Over by ₹${(spent - limit).toFixed(0)}` : `₹${(limit - spent).toFixed(0)} remaining`}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-100">
                {form.id ? 'Edit Budget' : 'Set New Budget'}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <Select
                  label="Category"
                  value={form.category_id}
                  onChange={(val) => setForm((f) => ({ ...f, category_id: val }))}
                  options={[
                    { value: '', label: 'Overall Budget (All Categories)' },
                    ...categories
                      .filter(c => !c.parent_id)
                      .flatMap(c => {
                        const subs = categories.filter(sub => sub.parent_id === c.id)
                        return [
                          { value: '', label: c.name, isHeader: true },
                          { value: c.id, label: `Main: ${c.name}` },
                          ...subs.map(sub => ({ value: sub.id, label: sub.name }))
                        ]
                      })
                  ]}
                />

                <Select
                  label="Period"
                  value={form.period}
                  onChange={(val: string) => setForm((f) => ({ ...f, period: val }))}
                  options={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'weekly', label: 'Weekly' },
                  ]}
                />

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Amount Limit
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition placeholder:text-slate-600"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {viewBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <BanknotesIcon className="w-5 h-5 text-emerald-400" />
                  {getCategoryName(viewBudget.category_id)} Transactions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {viewBudget.period} budget • Current month
                </p>
              </div>
              <button
                onClick={() => setViewBudget(null)}
                className="text-slate-400 hover:text-slate-200 transition p-1 hover:bg-slate-800 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 custom-scrollbar">
              {getBudgetExpenses(viewBudget).length === 0 ? (
                <div className="text-center py-12">
                  <TagIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400">No transactions found for this budget period.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getBudgetExpenses(viewBudget).map((expense) => (
                    <div
                      key={expense.id}
                      className="bg-slate-800/40 rounded-xl p-3 flex items-center justify-between border border-slate-700/50 hover:border-slate-600 transition cursor-pointer"
                      onClick={() => setSelectedExpenseForDetails(expense)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex-col flex items-center justify-center bg-slate-800 rounded-lg h-10 w-10 shrink-0 border border-slate-700 text-xs text-slate-400 font-medium">
                          <span className="leading-none">{new Date(expense.date).getDate()}</span>
                          <span className="text-[9px] uppercase mt-0.5">{new Date(expense.date).toLocaleString('default', { month: 'short' })}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{expense.title}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                             <span className="flex items-center gap-1">
                               <TagIcon className="w-3 h-3" />
                               {getCategoryName(expense.category_id)}
                             </span>
                             <span>•</span>
                             <span>Paid by {expense.payer_id === user?.id ? 'You' : 'Friend'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <span className="font-semibold text-slate-200 block">
                          ₹{Number(expense.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0 text-right">
                <span className="text-xs text-slate-500 mr-2">Total Spent:</span>
                <span className="text-lg font-bold text-slate-200">₹{getSpent(viewBudget.category_id).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
      <ExpenseDetailsDialog
        isOpen={!!selectedExpenseForDetails}
        onClose={() => setSelectedExpenseForDetails(null)}
        expense={selectedExpenseForDetails}
        categoryName={
          selectedExpenseForDetails
            ? getCategoryName(selectedExpenseForDetails.category_id ?? null)
            : ''
        }
        payerName={
          selectedExpenseForDetails
            ? getPayerName(selectedExpenseForDetails.payer_id ?? null)
            : ''
        }
        onEdit={(id) => {
          window.location.href = `/app/expenses?edit=${id}`
        }}
        onDelete={async (id) => {
          if (window.confirm('Delete this expense?')) {
            await supabase.from('expenses').delete().eq('id', id)
            // Local state update is handled via useExpenses hook if it re-fetches, 
            // but BudgetsPage doesn't have a direct setExpenses. 
            // However, it uses useExpenses() which should ideally stay in sync if it subscribes/polls.
            // For now, we rely on the user to refresh or the hook to update.
          }
        }}
      />
    </div>
  )
}


export default BudgetsPage

