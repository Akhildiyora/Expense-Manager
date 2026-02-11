import React from 'react'
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart as RechartsLineChart, Line } from 'recharts'

interface PieChartDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  data: Array<{
    name: string
    value: number
    color: string
  }>
  totalAmount: number
}

interface BarChartDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  data: Array<{
    name: string
    budget: number
    spent: number
  }>
}

interface LineChartDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  data: Array<{
    month: string
    amount: number
  }>
  totalSpending: number
}

const COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
  '#6b7280', // gray-500
]

export const PieChartDialog: React.FC<PieChartDialogProps> = ({
  isOpen,
  onClose,
  title,
  data,
  totalAmount,
}) => {
  if (!isOpen) return null

  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || COLORS[index % COLORS.length],
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = ((data.value / totalAmount) * 100).toFixed(1)
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-md p-3 text-sm">
          <p className="text-slate-200 font-medium">{data.name}</p>
          <p className="text-emerald-400">₹{data.value.toFixed(2)} ({percentage}%)</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="h-96 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4 text-slate-200">Detailed Breakdown</h3>
              <div className="space-y-3">
                {chartData
                  .sort((a, b) => b.value - a.value)
                  .map((item, index) => {
                    const percentage = ((item.value / totalAmount) * 100).toFixed(1)
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-slate-200 font-medium">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-semibold">₹{item.value.toFixed(2)}</div>
                          <div className="text-xs text-slate-400">{percentage}%</div>
                        </div>
                      </div>
                    )
                  })}
              </div>
              <div className="mt-6 p-4 bg-slate-900/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-slate-200 font-medium">Total</span>
                  <span className="text-emerald-400 font-bold text-lg">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const BarChartDialog: React.FC<BarChartDialogProps> = ({
  isOpen,
  onClose,
  title,
  data,
}) => {
  if (!isOpen) return null

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-md p-3 text-sm">
          <p className="text-slate-200 font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="mb-1">
              <span style={{ color: entry.color }} className="text-xs">
                {entry.name}: ₹{entry.value?.toFixed(2) || '0.00'}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="h-96 mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Bar dataKey="budget" fill="#3b82f6" name="Budget" />
                <Bar dataKey="spent" fill="#10b981" name="Spent" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-medium text-slate-200">Budget Performance</h3>
            {data.map((item, index) => {
              const difference = item.spent - item.budget
              const isOverBudget = difference > 0
              const percentage = item.budget > 0 ? ((item.spent / item.budget) * 100).toFixed(1) : '0.0'

              return (
                <div key={index} className="p-4 bg-slate-900/50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-slate-200 font-medium">{item.name}</span>
                    <span className={`text-sm font-medium ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                      {percentage}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Budget: </span>
                      <span className="text-blue-400">₹{item.budget.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Spent: </span>
                      <span className="text-emerald-400">₹{item.spent.toFixed(2)}</span>
                    </div>
                  </div>
                  {difference !== 0 && (
                    <div className="mt-2 text-sm">
                      <span className="text-slate-400">
                        {isOverBudget ? 'Over budget by: ' : 'Under budget by: '}
                      </span>
                      <span className={`font-medium ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                        ₹{Math.abs(difference).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export const LineChartDialog: React.FC<LineChartDialogProps> = ({
  isOpen,
  onClose,
  title,
  data,
  totalSpending,
}) => {
  if (!isOpen) return null

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-md p-3 text-sm">
          <p className="text-slate-200 font-medium mb-1">{label}</p>
          <p className="text-emerald-400">
            ₹{payload[0].value?.toFixed(2) || '0.00'}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <h4 className="text-sm text-slate-400 mb-1">Total Spending</h4>
              <p className="text-2xl font-bold text-emerald-400">₹{totalSpending.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <h4 className="text-sm text-slate-400 mb-1">Average per Month</h4>
              <p className="text-2xl font-bold text-blue-400">
                ₹{(totalSpending / Math.max(data.length, 1)).toFixed(2)}
              </p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <h4 className="text-sm text-slate-400 mb-1">Months Tracked</h4>
              <p className="text-2xl font-bold text-purple-400">{data.length}</p>
            </div>
          </div>

          <div className="h-96 mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2, fill: '#1f2937' }}
                  name="Monthly Spending"
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-200 mb-4">Monthly Breakdown</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.map((item, index) => (
                <div key={index} className="p-4 bg-slate-900/50 rounded-lg">
                  <div className="text-slate-200 font-medium mb-1">{item.month}</div>
                  <div className="text-emerald-400 font-bold text-lg">₹{item.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}