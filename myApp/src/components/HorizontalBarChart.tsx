import React from 'react'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface HorizontalBarChartProps {
  data: Array<{
    month: string
    amount: number
  }>
  title: string
  onClick?: () => void
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-md p-3 text-sm">
        <p className="text-slate-200 font-medium mb-1">{label}</p>
        <p className="text-emerald-400">
          Spent: ₹{payload[0].value?.toFixed(2) || '0.00'}
        </p>
      </div>
    )
  }
  return null
}

const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({ data, title, onClick }) => {

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 cursor-pointer hover:bg-slate-900/80 transition-colors flex flex-col"
        onClick={onClick}
      >
        <h3 className="text-sm font-medium mb-3">{title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">No trend data available</p>
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
            data={data}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} vertical={true} />
            <XAxis
              type="number"
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(value) => `₹${value}`}
              hide
            />
            <YAxis
              type="category"
              dataKey="month"
              stroke="#94a3b8"
              fontSize={11}
              width={70}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
            <Bar
              dataKey="amount"
              fill="#10b981"
              name="Monthly Spending"
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default HorizontalBarChart