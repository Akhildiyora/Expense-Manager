import React from 'react'
import { Select } from '../../components/Select'
import { QueueListIcon, CurrencyRupeeIcon } from '@heroicons/react/24/outline'

interface TripExpensesProps {
  expenses: any[]
  friends: any[]
  onAddExpense: () => void
  onSelectExpense: (id: string) => void
}

export const TripExpenses: React.FC<TripExpensesProps> = ({
  expenses,
  friends,
  onAddExpense,
  onSelectExpense
}) => {
  const [search, setSearch] = React.useState('')
  const [paymentMode, setPaymentMode] = React.useState<string>('')
  const [sortBy, setSortBy] = React.useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc')

  const filteredExpenses = React.useMemo(() => {
    return expenses
      .filter(e => {
        const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase())
        const matchesMode = paymentMode ? e.payment_mode === paymentMode : true
        return matchesSearch && matchesMode
      })
      .sort((a, b) => {
        const ord = sortOrder === 'asc' ? 1 : -1
        if (sortBy === 'date') {
          return (new Date(a.date).getTime() - new Date(b.date).getTime()) * ord
        } else {
          return (Number(a.amount) - Number(b.amount)) * ord
        }
      })
  }, [expenses, search, paymentMode, sortBy, sortOrder])

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <QueueListIcon className="w-4 h-4" /> Trip Expenses
            </h3>
            <button 
            onClick={onAddExpense}
            className="flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-sky-500/20"
            >
            <CurrencyRupeeIcon className="w-4 h-4" />
            Add Trip Expense
            </button>
        </div>


        <div className="flex flex-wrap gap-2">
            <input 
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-[2] min-w-[120px] rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            <div className="flex-1 min-w-[120px]">
               <Select
                  value={paymentMode}
                  onChange={(val) => setPaymentMode(val as any)}
                  options={[
                    { value: '', label: 'All Modes' },
                    { value: 'online', label: 'Online' },
                    { value: 'cash', label: 'Cash' },
                    { value: 'card', label: 'Card' },
                  ]}
                  placeholder="All Modes"
                  className="w-full"
               />
            </div>
            <div className="flex-[1.5] min-w-[160px]">
               <Select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(val) => {
                     const [sb, so] = val.split('-') as ['date' | 'amount', 'asc' | 'desc']
                     setSortBy(sb)
                     setSortOrder(so)
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
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <QueueListIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No expenses match your filters.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/50">
            {filteredExpenses.map(exp => (
              <li 
                key={exp.id} 
                className="p-4 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition group"
                onClick={() => onSelectExpense(exp.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-[10px]">
                    <span className="font-bold text-slate-300">{new Date(exp.date).getDate()}</span>
                    <span className="uppercase text-slate-500 font-medium">{new Date(exp.date).toLocaleString('default', { month: 'short' })}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200 truncate max-w-[150px] sm:max-w-xs">{exp.title}</p>
                    <p className="text-[10px] text-slate-500">
                      Paid by {exp.payer_id ? friends.find((f: any) => f.id === exp.payer_id)?.name || 'Friend' : 'You'}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-100">₹{Number(exp.amount).toFixed(2)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
