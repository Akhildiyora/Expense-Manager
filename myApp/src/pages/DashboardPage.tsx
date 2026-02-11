import React, { useEffect, useMemo, useState } from 'react'
import { Select } from '../components/Select'
import { useExpenses } from '../queries/useExpenses'
import { useBudgets } from '../queries/useBudgets'
import { useCategories } from '../queries/useCategories'
import { useNavigate } from 'react-router-dom'
import PieChart from '../components/PieChart'
import BarChart from '../components/BarChart'
import HorizontalBarChart from '../components/HorizontalBarChart'
import { PieChartDialog, BarChartDialog, LineChartDialog } from '../components/ChartDialogs'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'
import { getPersonalShare } from '../utils/expenseShare'

const DashboardPage: React.FC = () => {
  const { expenses } = useExpenses()
  const { budgets } = useBudgets()
  const { categories } = useCategories()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [pieChartOpen, setPieChartOpen] = useState(false)
  const [barChartOpen, setBarChartOpen] = useState(false)
  const [lineChartOpen, setLineChartOpen] = useState(false)
  const [splitSummary, setSplitSummary] = useState<{ owedToYou: number; youOwe: number }>({
    owedToYou: 0,
    youOwe: 0,
  })

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`

  useEffect(() => {
    if (!user) {
      setSplitSummary({ owedToYou: 0, youOwe: 0 })
      return
    }

    const fetchSplits = async () => {
      // STRICT SEPARATION: Fetch ONLY personal splits (trip_id is null)
      const { data, error } = await supabase
        .from('expense_splits')
        .select('friend_id, owed_to_friend_id, share_amount, expenses!inner(trip_id)')
        .is('expenses.trip_id', null)

      if (error || !data) {
        setSplitSummary({ owedToYou: 0, youOwe: 0 })
        return
      }

      const rows = (data ?? []) as { 
        friend_id: string | null; 
        owed_to_friend_id: string | null; 
        share_amount: number;
        expenses: { trip_id: string | null } | { trip_id: string | null }[]
      }[]

      let owedToYou = 0
      let youOwe = 0

      rows.forEach((row) => {
        const amt = Number(row.share_amount ?? 0)
        if (!amt) return

        // Friend owes you (you are the creditor)
        if (row.friend_id && !row.owed_to_friend_id) {
          owedToYou += amt
        }

        // You owe a friend (you are the debtor)
        if (!row.friend_id && row.owed_to_friend_id) {
          youOwe += amt
        }
      })

      setSplitSummary({ owedToYou, youOwe })
    }

    void fetchSplits()
  }, [user])

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized'
    return categories.find((c) => c.id === categoryId)?.name ?? 'Unknown'
  }

  const [selectedCategoryForPie, setSelectedCategoryForPie] = useState<string>('all')

  const {
    totalThisMonth,
    categoriesUsedCount,
    totalMonthlyBudget,
    pieChartData,
    barChartData,
    lineChartData,
  } = useMemo(() => {
    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })

    // Use your personal share for all high-level totals
    const total = monthExpenses.reduce((sum, e) => sum + getPersonalShare(e), 0)

    // Filter expenses for Pie Chart based on selection
    let pieExpenses = monthExpenses
    if (selectedCategoryForPie !== 'all') {
      // If a main category is selected, show expenses for that category (and its subcategories)
      // But we want to group by SUBCATEGORY instead of Main Category now.
      pieExpenses = monthExpenses.filter((e) => {
        if (!e.category_id) return false
        const cat = categories.find((c) => c.id === e.category_id)
        // Check if expense matches selected category directly OR if its parent matches
        return e.category_id === selectedCategoryForPie || cat?.parent_id === selectedCategoryForPie
      })
    }

    const byCategory = new Map<string, number>()
    
    if (selectedCategoryForPie === 'all') {
      // Default: Group by Main Category
      monthExpenses.forEach((e) => {
        const amt = getPersonalShare(e)
        if (amt <= 0) return
        const cat = categories.find((c) => c.id === e.category_id)
        // If it has a parent, group under parent. If local, group under self.
        const key = cat?.parent_id ?? e.category_id ?? 'uncategorized'
        byCategory.set(key, (byCategory.get(key) ?? 0) + amt)
      })
    } else {
      // Filtered: Group by Subcategory (Self)
      pieExpenses.forEach((e) => {
        const amt = getPersonalShare(e)
        if (amt <= 0) return
        const key = e.category_id ?? 'uncategorized'
        byCategory.set(key, (byCategory.get(key) ?? 0) + amt)
      })
    }

    // Budget logic: include all budgets and compare against your personal spend
    const usage = budgets.map((b) => {
      const relevantExpenses = monthExpenses.filter((e) =>
        b.category_id ? e.category_id === b.category_id : true,
      )
      const spent = relevantExpenses.reduce((sum, e) => sum + getPersonalShare(e), 0)
      return {
        id: b.id,
        category_id: b.category_id,
        amount: b.amount,
        spent,
      }
    })

    // Total budget limit across all periods
    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)

    // Prepare pie chart data
    const pieData = Array.from(byCategory.entries()).map(([catId, value]) => ({
      name: getCategoryName(catId === 'uncategorized' ? null : catId),
      value,
      color: '',
    }))

    // Prepare bar chart data
    const barData = usage.map((b) => ({
      name: b.category_id ? getCategoryName(b.category_id) : 'Overall Budget',
      budget: Number(b.amount),
      spent: b.spent,
    }))

    // Prepare line chart data (last 6 months)
    const lineData = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthExpenses = expenses.filter((e) => {
        const d = new Date(e.date)
        return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()
      })
      const monthTotal = monthExpenses.reduce(
        (sum, e) => sum + getPersonalShare(e),
        0,
      )
      lineData.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        amount: monthTotal,
      })
    }

    // Categories used count should be independent of the pie chart filter
    const categoriesUsed = new Set<string>()
    monthExpenses.forEach(e => {
      if (getPersonalShare(e) > 0) {
        categoriesUsed.add(e.category_id ?? 'uncategorized')
      }
    })

    return {
      totalThisMonth: total,
      categoriesUsedCount: categoriesUsed.size,
      totalMonthlyBudget: totalBudget,
      pieChartData: pieData,
      barChartData: barData,
      lineChartData: lineData,
    }
  }, [expenses, budgets, now, categories, selectedCategoryForPie])

  // Get Main Categories for Dropdown
  const mainCategories = useMemo(() => {
    return categories.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-14 md:pt-0">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-slate-400">
            {monthKey} · Snapshot of your spending
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/expenses?new=1')}
          className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition"
        >
          Add transaction
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total spent this month</p>
          <p className="mt-2 text-2xl font-semibold">
            ₹{totalThisMonth.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total budget limit</p>
          <p className="mt-2 text-2xl font-semibold">
            ₹{totalMonthlyBudget.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Active budgets</p>
          <p className="mt-2 text-2xl font-semibold">{budgets.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Categories used</p>
          <p className="mt-2 text-2xl font-semibold">
            {categoriesUsedCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2">
          <p className="text-xs text-slate-400">Splits summary</p>
          <div className="mt-2 flex items-baseline gap-6">
            <div>
              <p className="text-[11px] text-slate-400">Friends owe you</p>
              <p className="text-xl font-semibold text-emerald-300">
                ₹{splitSummary.owedToYou.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">You owe friends</p>
              <p className="text-xl font-semibold text-amber-300">
                ₹{splitSummary.youOwe.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
        <div className="h-[300px] flex flex-col relative">
           {/* Category Filter Dropdown */}
            <div className="w-40">
              <Select
                value={selectedCategoryForPie}
                onChange={setSelectedCategoryForPie}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...mainCategories.map((cat) => ({ value: cat.id, label: cat.name }))
                ]}
                placeholder="All Categories"
              />
            </div>

          <PieChart
            data={pieChartData}
            title={selectedCategoryForPie === 'all' ? "Spending by Category" : `Spending: ${getCategoryName(selectedCategoryForPie)}`}
            onClick={() => setPieChartOpen(true)}
          />
        </div>

        <div className="h-[300px] flex flex-col">
          <BarChart
            data={barChartData}
            title="Budget vs Actual"
            onClick={() => setBarChartOpen(true)}
          />
        </div>

        <div className="h-[300px] flex flex-col lg:col-span-1 md:col-span-2 sm:col-span-1">
          <HorizontalBarChart
            data={lineChartData}
            title="Spending Trends"
            onClick={() => setLineChartOpen(true)}
          />
        </div>
      </section>

      {/* Chart Dialogs */}
      <PieChartDialog
        isOpen={pieChartOpen}
        onClose={() => setPieChartOpen(false)}
        title="Detailed Spending by Category"
        data={pieChartData}
        totalAmount={totalThisMonth}
      />

      <BarChartDialog
        isOpen={barChartOpen}
        onClose={() => setBarChartOpen(false)}
        title="Detailed Budget Performance"
        data={barChartData}
      />

      <LineChartDialog
        isOpen={lineChartOpen}
        onClose={() => setLineChartOpen(false)}
        title="Detailed Spending Trends"
        data={lineChartData}
        totalSpending={lineChartData.reduce((sum, item) => sum + item.amount, 0)}
      />
    </div>
  )
}

export default DashboardPage

