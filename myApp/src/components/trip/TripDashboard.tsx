import React, { useMemo, useState } from 'react'
import { CalendarIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import PieChart from '../PieChart'
import HorizontalBarChart from '../HorizontalBarChart'
import { PieChartDialog } from '../ChartDialogs'
import type { Trip } from '../../queries/useTrips'
import type { Category } from '../../queries/useCategories'
import type { Expense } from '../../queries/useExpenses'
type TripMember = {
  friend_id: string
  friends: {
    name: string
  }
}

interface TripDashboardProps {
  trip: Trip
  members: TripMember[]
  expenses: Expense[]
  categories: Category[]
  tripTotal: number
  personalTotal: number
  budgetUsed: number
  isOverBudget: boolean
}

export const TripDashboard: React.FC<TripDashboardProps> = ({
  trip,
  members,
  expenses,
  categories,
  tripTotal,
  personalTotal,
  budgetUsed,
  isOverBudget
}) => {
  const [pieDialogOpen, setPieDialogOpen] = useState(false)
  
  // 1. Daily Spending Trend (Bar Chart)
  const dailyData = useMemo(() => {
    const dailyMap = new Map<string, number>()
    
    // Initialize dates between start and end if possible, otherwise just use expense dates
    // For simplicity, just use expense dates sorted
    expenses.forEach(e => {
      const date = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      dailyMap.set(date, (dailyMap.get(date) || 0) + Number(e.amount))
    })

    // Sort by date key (this might be tricky with formatted strings, let's try to keep it simple for now or rely on accidental sorting if query was sorted)
    // The expenses are passed sorted by date (descending) from parent.
    // We strictly want ascending for the chart.
    const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    const data: { date: string; amount: number }[] = []
    const processedDates = new Set<string>()

    sortedExpenses.forEach(e => {
        const dateKey = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (!processedDates.has(dateKey)) {
            // Sum all for this day (since logic above was just map, here we reconstruct)
            // Actually, let's just use the map but iterate in order of sorted keys? 
            // Better:
            const daySum = expenses.filter(exp => new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) === dateKey)
                                   .reduce((sum, exp) => sum + Number(exp.amount), 0)
            data.push({ date: dateKey, amount: daySum })
            processedDates.add(dateKey)
        }
    })
    
    return data
  }, [expenses])

  // 2. Category Breakdown (Pie Chart)
  const categoryData = useMemo(() => {
    const catMap = new Map<string, number>()
    expenses.forEach(e => {
      const catName = categories.find(c => c.id === e.category_id)?.name || 'Uncategorized'
      catMap.set(catName, (catMap.get(catName) || 0) + Number(e.amount))
    })

    return Array.from(catMap.entries()).map(([name, value]) => ({
      name,
      value,
      color: '' // PieChart component assigns colors
    })).sort((a, b) => b.value - a.value)
  }, [expenses, categories])

  // 3. Member Spending (Who Paid) - Horizontal Bar Chart
  const memberSpendingData = useMemo(() => {
    const payerMap = new Map<string, number>()
    expenses.forEach(e => {
      const payerName = e.payer_id 
        ? (members.find(m => m.friend_id === e.payer_id)?.friends?.name || 'Unknown') 
        : 'You'
      payerMap.set(payerName, (payerMap.get(payerName) || 0) + Number(e.amount))
    })

    return Array.from(payerMap.entries())
      .map(([name, amount]) => ({ month: name, amount })) // Reuse 'month' prop as Label
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, members])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Info */}
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> {trip.start_date || 'N/A'} - {trip.end_date || 'N/A'}</span>
        <span>•</span>
        <span className="flex items-center gap-1"><UserGroupIcon className="w-4 h-4" /> {members.length} Members</span>
      </div>

      {/* Overview Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Total Trip Cost</p>
          <p className="text-2xl font-bold text-slate-100">₹{tripTotal.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Your Share</p>
          <p className="text-2xl font-bold text-emerald-400">₹{personalTotal.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Budget Status</p>
          {trip.budget ? (
            <>
              <div className="flex justify-between items-end mb-2">
                <span className={`text-xl font-bold ${isOverBudget ? 'text-red-400' : 'text-sky-400'}`}>
                  {budgetUsed.toFixed(0)}%
                </span>
                <span className="text-xs text-slate-500">Limit: ₹{Number(trip.budget).toLocaleString()}</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${isOverBudget ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]'}`}
                  style={{ width: `${Math.min(100, budgetUsed)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm italic">No budget set for this trip.</p>
          )}
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 min-h-[300px]">
         {/* Daily Trend */}
         <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Spending Trend</h3>
            <div className="flex-1 w-full min-h-[200px]">
               {dailyData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <RechartsBarChart data={dailyData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} vertical={false} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334151', color: '#f1f5f9' }}
                        cursor={{ fill: '#334155', opacity: 0.2 }}
                      />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                   </RechartsBarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">No expenses yet.</div>
               )}
            </div>
         </div>

         {/* Category Pie Chart */}
         <div className="h-[300px]">
            <PieChart 
              data={categoryData}
              title="Category Analysis"
              onClick={() => setPieDialogOpen(true)}
            />
         </div>

         {/* Member Spending (Horizontal) */}
         <div className="lg:col-span-1 h-[300px]">
            <HorizontalBarChart
               data={memberSpendingData}
               title="Top Spenders"
            />
         </div>
      </section>

      <PieChartDialog 
        isOpen={pieDialogOpen}
        onClose={() => setPieDialogOpen(false)}
        title="Spending By Category"
        data={categoryData}
        totalAmount={tripTotal}
      />
      
      {/* Reusing LineChartDialog structure for Member Spending for now, actually let's use a simple dialog if needed or skip detail click for members. 
          Given I used HorizontalBarChart which has onClick, I should probably handle it.
          I'll just reuse LineChartDialog effectively as a generic list viewer or just not implement the dialog for members if complex. 
          The user asked for graphical representation, the on-click detail is a bonus.
          Let's verify what LineChartDialog expects.
      */}
    </div>
  )
}
