import React, { useState, useEffect } from 'react'
import { Select } from './Select'
import { useCategories } from '../queries/useCategories'
import { useFriends } from '../queries/useFriends'
import { useTrips } from '../queries/useTrips'
import type { ExpenseFormState } from '../utils/expenseService'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../supabaseClient'

interface ExpenseFormProps {
  initialData?: ExpenseFormState
  onSubmit: (data: ExpenseFormState) => Promise<void>
  onCancel: () => void
  showTripSelect?: boolean
  tripId?: string
  title?: string
  submitLabel?: string
}

const emptyForm = (): ExpenseFormState => {
  const today = new Date().toISOString().slice(0, 10)
  return {
    amount: '',
    currency: 'INR',
    date: today,
    category_id: '',
    title: '',
    note: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
    friendIds: [],
    splitEvenly: true,
    isSplit: false,
    includeUser: true,
    payerId: 'you',
    trip_id: null,
    payment_mode: 'cash',
  }
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  showTripSelect = true,
  tripId,
  submitLabel = 'Save expense'
}) => {
  const { categories, setCategories, getMainCategories, getSubcategories } = useCategories()
  const { friends } = useFriends()
  const { trips } = useTrips()
  const { user } = useAuth()

  const [form, setForm] = useState<ExpenseFormState>(initialData || { ...emptyForm(), trip_id: tripId || null })
  const [saving, setSaving] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null)

  useEffect(() => {
    if (tripId) {
      setForm(f => ({ ...f, trip_id: tripId }))
    }
  }, [tripId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit(form)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!user) return
    const name = newCategoryName.trim()
    if (!name) return

    setCreatingCategory(true)
    const { data, error: insertError } = await supabase
      .from('categories')
      .insert({
        name,
        icon: null,
        user_id: user.id,
        parent_id: parentCategoryId || null,
      })
      .select()
      .single()
    setCreatingCategory(false)

    if (insertError || !data) {
      alert(insertError?.message ?? 'Failed to create category')
      return
    }

    setCategories((prev: any) => [...prev, data])
    setForm((f) => ({ ...f, category_id: data.id }))
    setNewCategoryName('')
    setShowNewCategoryInput(false)
    setParentCategoryId(null)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overflow-x-hidden text-sm min-w-0">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">Amount</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div className="w-20">
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">Currency</label>
            <input
              type="text"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-2 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [color-scheme:dark]"
            />
          </div>
        </div>
        
        <div>
          <label className="block mb-1.5 text-slate-400 text-xs font-medium">Title</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Lunch, Fuel"
            className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {/* Payment Mode */}
        <Select
          label="Payment Mode"
          value={form.payment_mode}
          onChange={(val) => setForm(f => ({ ...f, payment_mode: val as 'cash' | 'online' | 'card' }))}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'online', label: 'Online' },
            { value: 'card', label: 'Card' }
          ]}
        />

        <div className="space-y-2">
            <label className="block text-slate-400 text-xs font-medium">Category</label>
            {(() => {
                const selectedCat = categories.find((c) => c.id === form.category_id)
                const selectedMainId = form.category_id ? (selectedCat?.parent_id ?? form.category_id) : ''
                const subOptions = getSubcategories(selectedMainId)
                return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                <Select
                    label="Main category"
                    value={selectedMainId}
                    onChange={(val) => setForm((f) => ({ ...f, category_id: val }))}
                    options={[
                    { value: '', label: 'Uncategorized' },
                    ...getMainCategories().map((c) => ({ value: c.id, label: c.name }))
                    ]}
                />
                </div>
                <div>
                <Select
                    label="Subcategory"
                    value={selectedCat?.parent_id ? form.category_id : ''}
                    onChange={(val) => setForm((f) => ({ ...f, category_id: val }))}
                    placeholder={!selectedMainId ? 'Select main first' : subOptions.length === 0 ? 'No subcategories' : 'Choose subcategory'}
                    options={subOptions.map((sub) => ({ value: sub.id, label: sub.name }))}
                />
                </div>
            </div>
                )
            })()}
            
            <div className="flex gap-2 mt-1">
                <button
                type="button"
                className="text-[11px] text-emerald-400 hover:text-emerald-300"
                onClick={() => {
                    setParentCategoryId(null)
                    setShowNewCategoryInput(true)
                    setTimeout(() => document.getElementById('new-category-name')?.focus(), 0)
                }}
                >
                + Add main category
                </button>
                {getMainCategories().length > 0 && (
                <button
                    type="button"
                    className="text-[11px] text-sky-400 hover:text-sky-300"
                    onClick={() => {
                    const selectedMainId = form.category_id ? (categories.find((c) => c.id === form.category_id)?.parent_id ?? form.category_id) : ''
                    setParentCategoryId(selectedMainId || getMainCategories()[0]?.id || null)
                    setShowNewCategoryInput(true)
                    setTimeout(() => document.getElementById('new-category-name')?.focus(), 0)
                    }}
                >
                    + Add subcategory
                </button>
                )}
            </div>
            {showNewCategoryInput && (
                <div className="flex flex-wrap gap-2 items-center mt-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700 w-full min-w-0">
                <input
                    id="new-category-name"
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={parentCategoryId ? 'Subcategory name' : 'Main category name'}
                    className="flex-1 min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 w-full sm:w-auto"
                />
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                    <button type="button" onClick={() => void handleCreateCategory()} disabled={creatingCategory} className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-medium disabled:opacity-60 shrink-0">
                    {creatingCategory ? '…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); setParentCategoryId(null) }} className="text-slate-400 hover:text-slate-200 text-xs shrink-0">Cancel</button>
                    {parentCategoryId !== null && getMainCategories().length > 0 && (
                    <div className="w-40 shrink-0">
                      <Select
                        value={parentCategoryId || ''}
                        onChange={(val) => setParentCategoryId(val || null)}
                        options={[
                          { value: '', label: 'Main category' },
                          ...getMainCategories().map((c) => ({ value: c.id, label: `Under ${c.name}` }))
                        ]}
                        placeholder="Main category"
                      />
                    </div>
                    )}
                </div>
                </div>
            )}
        </div>

        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <input
                id="recurring"
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                />
                <label htmlFor="recurring" className="text-slate-400 text-xs">Recurring expense</label>
            </div>
            {form.is_recurring && (
                <div className="ml-6 animate-in fade-in slide-in-from-top-1 duration-200">
                <Select
                    value={form.recurring_frequency ?? 'monthly'}
                    onChange={(val) => setForm(f => ({ ...f, recurring_frequency: val }))}
                    options={[
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly' },
                      { value: 'yearly', label: 'Yearly' },
                    ]}
                />
                </div>
            )}
        </div>

        <div>
            <label className="block mb-1.5 text-slate-400 text-xs font-medium">Note</label>
            <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Optional notes"
                className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2.5 text-slate-100 placeholder-slate-500 min-h-[72px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            />
        </div>

        {showTripSelect && (
            <Select
                label="Link to Trip (Optional)"
                value={form.trip_id || ''}
                onChange={(val) => setForm(f => ({ ...f, trip_id: val || null }))}
                placeholder="No Trip"
                options={[
                { value: '', label: 'No Trip' },
                ...trips.map((trip) => ({ value: trip.id, label: trip.name }))
                ]}
            />
        )}

        <div className="flex items-center gap-2">
            <input
            id="split"
            type="checkbox"
            checked={form.isSplit}
            onChange={(e) =>
                setForm((f) => ({ ...f, isSplit: e.target.checked, friendIds: e.target.checked ? f.friendIds : [] }))
            }
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
            />
            <label htmlFor="split" className="text-slate-400 text-xs">
            Split with friends
            </label>
        </div>

        {form.isSplit && (
            <div className="border-t border-slate-800 pt-3 mt-2 space-y-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">Participants</span>
                <span className="text-[10px] text-slate-500">
                Select everyone involved
                </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
                <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, includeUser: !f.includeUser }))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    form.includeUser
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                >
                    You
                </button>
                {friends.map((friend) => (
                    <button
                    key={friend.id}
                    type="button"
                    onClick={() => {
                        setForm((f) => ({
                        ...f,
                        friendIds: f.friendIds.includes(friend.id)
                            ? f.friendIds.filter((id) => id !== friend.id)
                            : [...f.friendIds, friend.id],
                        }))
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                        form.friendIds.includes(friend.id)
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                    >
                    {friend.name}
                    </button>
                ))}
            </div>
            
            <div className="pt-2">
                <label className="block text-slate-400 text-xs font-medium mb-1.5">Paid by</label>
                <Select
                  value={form.payerId}
                  onChange={(val) => setForm(f => ({ ...f, payerId: val }))}
                  options={[
                    { value: 'you', label: 'You' },
                    ...form.friendIds.map((id) => {
                      const friend = friends.find((f) => f.id === id)
                      return { value: id, label: friend?.name || 'Unknown' }
                    })
                  ]}
                />
            </div>
            </div>
        )}
      </div>

      <div className="p-4 sm:p-6 border-t border-slate-700/80 mt-auto bg-slate-900/95 backdrop-blur-sm">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-medium text-slate-300 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
