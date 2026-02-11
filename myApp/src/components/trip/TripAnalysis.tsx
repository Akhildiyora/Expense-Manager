import React, { useMemo } from 'react'
import { ChartPieIcon } from '@heroicons/react/24/outline'

import type { Expense } from '../../queries/useExpenses'
import type { Category } from '../../queries/useCategories'

interface TripAnalysisProps {
  expenses: Expense[]
  categories: Category[]
  tripTotal: number
}

export const TripAnalysis: React.FC<TripAnalysisProps> = ({
  expenses,
  categories,
  tripTotal
}) => {
  const categoryBreakdown = useMemo(() => {
    const stats: Record<string, { name: string; amount: number; color: string }> = {}

    expenses.forEach(exp => {
      const catId = exp.category_id
      const amount = Number(exp.amount)
      
      if (!catId) {
        if (!stats['uncategorized']) {
          stats['uncategorized'] = { name: 'Uncategorized', amount: 0, color: '#94a3b8' }
        }
        stats['uncategorized'].amount += amount
      } else {
        const cat = categories.find(c => c.id === catId)
        const name = cat ? cat.name : 'Unknown'
        // Simple color generation or mapping
        const color = cat?.color || '#38bdf8' // Default sky blue

        if (!stats[catId]) {
          stats[catId] = { name, amount: 0, color }
        }
        stats[catId].amount += amount
      }
    })

    return Object.values(stats).sort((a, b) => b.amount - a.amount)
  }, [expenses, categories])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
         <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <ChartPieIcon className="w-4 h-4" /> Spending by Category
        </h3>
        <p className="text-xs text-slate-500">Total: ₹{tripTotal.toLocaleString()}</p>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        {categoryBreakdown.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
             <ChartPieIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
             <p className="text-sm">No expenses to analyze yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {categoryBreakdown.map((item, idx) => {
              const percentage = tripTotal > 0 ? (item.amount / tripTotal) * 100 : 0
              return (
                <div key={idx}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{item.name}</span>
                    <span className="text-slate-400">
                      ₹{item.amount.toLocaleString()} <span className="text-slate-600">({percentage.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${percentage}%`, backgroundColor: item.color }} 
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
