import React, { useMemo, useState } from 'react'
import { useCategories } from '../queries/useCategories'
import { useExpenses, type Expense } from '../queries/useExpenses'
import { useFriends } from '../queries/useFriends'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'
import { Select } from '../components/Select'
import { ExpenseDetailsDialog } from '../components/ExpenseDetailsDialog'
import { getPersonalShare } from '../utils/expenseShare'

type CategoryType = 'main' | 'sub'

const CategoriesPage: React.FC = () => {
  const { categories, loading, error, setCategories, getMainCategories, getSubcategories } = useCategories()
  const { expenses } = useExpenses({})
  const { friends } = useFriends()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [categoryType, setCategoryType] = useState<CategoryType>('main')
  const [expandedMainIds, setExpandedMainIds] = useState<Set<string>>(new Set())
  const { user } = useAuth()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState<Expense | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedMainIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const spendingByCategoryId = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach((e) => {
      if (!e.category_id) return
      const amt = getPersonalShare(e, user?.id)
      if (amt <= 0) return
      map[e.category_id] = (map[e.category_id] ?? 0) + amt
    })
    return map
  }, [expenses, user?.id])

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
    payerId ? friends.find((f) => f.id === payerId)?.name ?? 'Unknown' : 'You'

  const handleCategoryClick = (id: string) => {
    setSelectedCategoryId(id)
  }

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId) ?? null
    : null

  const selectedCategoryExpenses = useMemo(() => {
    if (!selectedCategory) return []

    const isMain = !selectedCategory.parent_id
    const categoryIds = isMain
      ? [selectedCategory.id, ...getSubcategories(selectedCategory.id).map((s) => s.id)]
      : [selectedCategory.id]

    return expenses
      .filter((e) => e.category_id && categoryIds.includes(e.category_id))
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      )
  }, [selectedCategory, expenses, getSubcategories])

  const totalSpendingForMainAndSubs = React.useCallback((mainId: string) => {
    const mainSpent = spendingByCategoryId[mainId] ?? 0
    const subIds = getSubcategories(mainId).map((s) => s.id)
    const subSpent = subIds.reduce((sum, id) => sum + (spendingByCategoryId[id] ?? 0), 0)
    return mainSpent + subSpent
  }, [spendingByCategoryId, getSubcategories])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (!user) return
    if (categoryType === 'sub' && !parentId) return
    setSaving(true)
    const { data, error: insertError } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        icon: null,
        user_id: user.id,
        parent_id: categoryType === 'sub' ? parentId : null,
      })
      .select()
      .single()
    setSaving(false)
    if (insertError) return
    setCategories([data, ...categories])
    setName('')
    setParentId(null)
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = window.confirm(`Delete category "${name}"? Existing expenses will become uncategorized.`)
    if (!ok) return

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      
      if (error) {
        console.error('Error deleting category:', error)
        alert(`Failed to delete category: ${error.message}`)
        return
      }
      
      // Optimistic update
      setCategories(categories.filter((c) => c.id !== id))
    } catch (err: unknown) {
      console.error('Unexpected error deleting category:', err)
      const msg = err instanceof Error ? err.message : String(err)
      alert(`An unexpected error occurred: ${msg}`)
    }
  }

  const [search, setSearch] = React.useState('')
  const [sortOrder, setSortOrder] = React.useState<'name' | 'spending-high'>('name')

  const filteredMainCategories = React.useMemo(() => {
    let result = getMainCategories()

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(m => {
        const matchMain = m.name.toLowerCase().includes(q)
        const subs = getSubcategories(m.id)
        const matchSub = subs.some(s => s.name.toLowerCase().includes(q))
        return matchMain || matchSub
      })
    }

    if (sortOrder === 'spending-high') {
       result.sort((a, b) => totalSpendingForMainAndSubs(b.id) - totalSpendingForMainAndSubs(a.id))
    } else {
       result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [getMainCategories, search, getSubcategories, sortOrder, totalSpendingForMainAndSubs])

  return (
    <div className="space-y-6">
      <header className="pt-14 md:pt-0">
        <h2 className="text-xl font-semibold text-slate-50">Categories</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Main and subcategories with spending per category.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-xs font-medium">Add</span>
          <div className="flex rounded-lg border border-slate-600 bg-slate-800/80 p-0.5">
            <button
              type="button"
              onClick={() => {
                setCategoryType('main')
                setParentId(null)
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                categoryType === 'main'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Main category
            </button>
            <button
              type="button"
              onClick={() => setCategoryType('sub')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                categoryType === 'sub'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Subcategory
            </button>
          </div>
        </div>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end text-sm">
          <div className="flex-1 min-w-[140px]">
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={categoryType === 'main' ? 'Main category name' : 'Subcategory name'}
              className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          {categoryType === 'sub' && (
            <div className="w-full sm:w-48 min-w-0">
              <label className="block mb-1.5 text-slate-400 text-xs font-medium">Under main category</label>
              {getMainCategories().length === 0 ? (
                <p className="text-xs text-amber-400/90 py-1">Add a main category first.</p>
              ) : (
                <Select
                  value={parentId ?? ''}
                  onChange={(val) => setParentId(val || null)}
                  options={[
                    { value: '', label: '— Select main category —' },
                    ...getMainCategories().map((c) => ({ value: c.id, label: c.name }))
                  ]}
                  placeholder="Select main category"
                />
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={saving || (categoryType === 'sub' && getMainCategories().length === 0)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-medium disabled:opacity-60 transition"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-2 rounded-2xl border border-slate-800/50">
         <input 
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
         />
         <div className="w-full sm:w-48">
            <Select
               value={sortOrder}
               onChange={(val) => setSortOrder(val as 'name' | 'spending-high')}
               options={[
                  { value: 'name', label: 'Name (A-Z)' },
                  { value: 'spending-high', label: 'Spending (High-Low)' },
               ]}
               placeholder="Sort by"
            />
         </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400 flex gap-2 sm:gap-4 flex-wrap">
          <div className="flex-1 min-w-[100px]">Name</div>
          <div className="w-16 sm:w-20 text-center shrink-0">Type</div>
          <div className="w-20 sm:w-28 text-right shrink-0">Spending</div>
          <div className="w-16 sm:w-24 text-right shrink-0">Actions</div>
        </div>
        {loading && (
          <div className="px-4 py-6 text-sm text-slate-400">Loading categories…</div>
        )}
        {error && (
          <div className="px-4 py-4 text-sm text-red-400">Error: {error}</div>
        )}
        {!loading && categories.length === 0 && !error && (
          <div className="px-4 py-8 text-sm text-slate-400 text-center">
            No categories yet. Create a main category or subcategory above.
          </div>
        )}
        <div className="divide-y divide-slate-800">
          {filteredMainCategories.map((mainCat) => {
            const subs = getSubcategories(mainCat.id)
            const totalMainAndSubs = totalSpendingForMainAndSubs(mainCat.id)
            const isExpanded = expandedMainIds.has(mainCat.id)
            return (
              <div key={mainCat.id} className="bg-slate-900/40">
                <div
                  className="px-4 py-3 text-sm text-slate-200 flex items-center gap-2 sm:gap-4 hover:bg-slate-800/40 transition cursor-pointer"
                  onClick={() => handleCategoryClick(mainCat.id)}
                >
                  <button
                    type="button"
                    className="p-0.5 -ml-0.5 rounded text-slate-400 hover:text-slate-200 shrink-0 transition-transform"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(mainCat.id)
                    }}
                  >
                    <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="flex-1 font-medium min-w-0 truncate">{mainCat.name}</div>
                  <div className="w-16 sm:w-20 flex justify-center shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-medium border border-emerald-500/30">
                      Main
                    </span>
                  </div>
                  <div className="w-20 sm:w-28 text-right text-slate-300 shrink-0">
                    ₹{totalMainAndSubs.toFixed(2)}
                  </div>
                  <div className="w-16 sm:w-24 text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-300 text-xs font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(mainCat.id, mainCat.name)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {isExpanded && subs.length > 0 && (
                  <div className="border-l-2 border-slate-700 ml-4 mb-2">
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        className="px-4 py-2.5 pl-6 text-sm text-slate-300 flex items-center gap-2 sm:gap-4 hover:bg-slate-800/30 transition cursor-pointer"
                        onClick={() => handleCategoryClick(sub.id)}
                      >
                        <div className="flex-1 min-w-0 truncate">{sub.name}</div>
                        <div className="w-16 sm:w-20 flex justify-center shrink-0">
                          <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-400 text-[10px] font-medium border border-sky-500/30">
                            Sub
                          </span>
                        </div>
                        <div className="w-20 sm:w-28 text-right text-slate-300 shrink-0">
                          ₹{(spendingByCategoryId[sub.id] ?? 0).toFixed(2)}
                        </div>
                        <div className="w-16 sm:w-24 text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="text-red-400 hover:text-red-300 text-xs font-medium"
                            onClick={() => void handleDelete(sub.id, sub.name)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {getCategoryName(selectedCategory.id)} Transactions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">All transactions for this category</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId(null)
                  setSelectedExpenseForDetails(null)
                }}
                className="text-slate-400 hover:text-slate-200 transition p-1 hover:bg-slate-800 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-4 custom-scrollbar">
              {selectedCategoryExpenses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">No transactions found for this category yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCategoryExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="bg-slate-800/40 rounded-xl p-3 flex items-center justify-between border border-slate-700/50 hover:border-slate-600 transition cursor-pointer"
                      onClick={() => setSelectedExpenseForDetails(expense)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex-col flex items-center justify-center bg-slate-800 rounded-lg h-10 w-10 shrink-0 border border-slate-700 text-xs text-slate-400 font-medium">
                          <span className="leading-none">{new Date(expense.date).getDate()}</span>
                          <span className="text-[9px] uppercase mt-0.5">
                            {new Date(expense.date).toLocaleString('default', { month: 'short' })}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{expense.title}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{getCategoryName(expense.category_id)}</span>
                            <span>•</span>
                            <span>Paid by {expense.payer_id ? getPayerName(expense.payer_id) : 'You'}</span>
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
              <span className="text-xs text-slate-500 mr-2">Your total for this category:</span>
              <span className="text-lg font-bold text-slate-200">
                ₹
                {selectedCategoryExpenses
                  .reduce((sum, e) => sum + getPersonalShare(e, user?.id), 0)
                  .toFixed(2)}
              </span>
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
      />
    </div>
  )
}

export default CategoriesPage
