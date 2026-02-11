import React from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BarChartProps {
  data: Array<{
    name: string
    budget: number
    spent: number
  }>
  title: string
  onClick?: () => void
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      name: string
      budget: number
      spent: number
      isOver: boolean
    }
  }>
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const dataItem = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-md p-3 text-sm z-50">
        <p className="text-slate-200 font-medium mb-2">{label}</p>
        <div className="space-y-1">
          <p className={`${dataItem.isOver ? 'text-red-400' : 'text-emerald-400'}`}>
            Spent: ₹{dataItem.spent.toFixed(2)}
          </p>
          <p className="text-blue-400">
            {dataItem.isOver ? 'Budget Limit: ' : 'Remaining: '}
            ₹
            {dataItem.isOver
              ? dataItem.budget.toFixed(2)
              : (dataItem.budget - dataItem.spent).toFixed(2)}
          </p>
          {dataItem.isOver && (
            <p className="text-red-400 border-t border-slate-700/50 pt-1 mt-1">
              Over by: ₹{(dataItem.spent - dataItem.budget).toFixed(2)}
            </p>
          )}
          {!dataItem.isOver && (
            <p className="text-slate-400 pt-1 border-t border-slate-700/50 mt-1">
              Budget: ₹{dataItem.budget.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    )
  }
  return null
}

const BarChart: React.FC<BarChartProps> = ({ data, title, onClick }) => {
  // Transform data for stacked chart
  // Logic:
  // Under Budget: Green (Spent) + Blue (Remaining)
  // Over Budget: Blue (Budget) + Red (Excess)
  const chartData = data.map((item) => {
    const isOver = item.spent > item.budget
    const entry: any = { ...item, isOver }

    if (isOver) {
      // Over Budget: Blue (within budget) + Red (excess)
      entry.part_green = 0
      entry.part_blue_remaining = 0 // Not used in this mode
      entry.part_blue_budget = item.budget // "Make blue upto budget"
      entry.part_red = item.spent - item.budget
    } else {
      // Under Budget: Green (spent) + Blue (remaining)
      entry.part_green = item.spent
      entry.part_blue_remaining = item.budget - item.spent
      entry.part_blue_budget = 0
      entry.part_red = 0
    }
    return entry
  })

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 cursor-pointer hover:bg-slate-900/80 transition-colors flex flex-col"
        onClick={onClick}
      >
        <h3 className="text-sm font-medium mb-3">{title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">No budget data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 cursor-pointer hover:bg-slate-900/80 transition-colors flex flex-col">
      <h3 className="text-sm font-medium mb-3 shrink-0">{title}</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={chartData}
            margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
            stackOffset="sign"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              opacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: '#334155', opacity: 0.2 }}
            />
            
            {/* Stack Order: Green -> Blue (Budget or Remaining) -> Red */}
            
            {/* 1. Green: Spent (Only if under budget) */}
            <Bar
              dataKey="part_green"
              stackId="a"
              name="Spent"
              fill="#10b981"
              radius={[0, 0, 4, 4]}
              maxBarSize={50}
            />

            {/* 2. Blue: Budget (if over) OR Remaining (if under) */}
            {/* We map both to same stack level effectively by having them as separate bars but logic ensures only one has value? 
                Actually we can just use one bar with conditional fill if we want, but better to use separate keys to avoid animation glitches if values swap.
                Let's stack them.
            */}
             <Bar
              dataKey="part_blue_budget"
              stackId="a"
              name="Budget"
              fill="#3b82f6"
              radius={[0, 0, 4, 4]} // Bottom rounding because it's the base when over budget
              maxBarSize={50}
            />
            <Bar
              dataKey="part_blue_remaining"
              stackId="a"
              name="Remaining"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]} // Top rounding because it's on top of Green
              maxBarSize={50}
            />

            {/* 3. Red: Excess (Only if over budget) */}
            <Bar
              dataKey="part_red"
              stackId="a"
              name="Over"
              fill="#ef4444"
              radius={[4, 4, 0, 0]} // Top rounding
              maxBarSize={50}
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-[2px] bg-emerald-500"></div>
          <span>Spent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-[2px] bg-blue-500"></div>
          <span>Remaining / Budget</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-[2px] bg-red-500"></div>
          <span>Over Budget</span>
        </div>
      </div>
    </div>
  )
}

export default BarChart