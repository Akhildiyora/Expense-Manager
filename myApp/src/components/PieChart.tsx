import React from 'react'
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface PieChartProps {
  data: Array<{
    name: string
    value: number
    color: string
  }>
  title: string
  onClick?: () => void
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-md p-2 text-sm z-50">
        <p className="text-slate-200">{data.name}</p>
        <p className="text-emerald-400 font-medium">₹{Number(data.value).toFixed(2)}</p>
      </div>
    )
  }
  return null
}

const PieChart: React.FC<PieChartProps> = ({ data, title, onClick }) => {
  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || COLORS[index % COLORS.length],
  }))

  if (data.length === 0) {
    return (
      <div
        className="w-full h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 cursor-pointer hover:bg-slate-900/80 transition-colors flex flex-col"
        onClick={onClick}
      >
        <h3 className="text-sm font-medium mb-3">{title}</h3>
        <div className="flex-1 flex items-center justify-center text-slate-500">
          No data available
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 cursor-pointer hover:bg-slate-900/80 transition-colors flex flex-col">
      <h3 className="text-sm font-medium mb-3 shrink-0">{title}</h3>
      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: '10px', color: '#94a3b8', right: 0 }}
              iconType="circle"
              iconSize={8}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default PieChart