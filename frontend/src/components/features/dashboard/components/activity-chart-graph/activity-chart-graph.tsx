import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActivityChartPoint } from '@/components/features/dashboard/components/activity-chart'

interface TooltipPayloadItem {
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<TooltipPayloadItem>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-content1 rounded-large border border-default-200 px-3 py-2">
      <p className="text-xs text-default-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-default-800">
        {payload[0].value}
      </p>
    </div>
  )
}

interface ActivityChartGraphProps {
  data: Array<ActivityChartPoint>
  color: string
}

// Split out of `activity-chart.tsx` so `recharts` (~340 kB) loads lazily instead
// of on the dashboard's first paint. The card shell renders immediately.
export default function ActivityChartGraph({
  data,
  color,
}: ActivityChartGraphProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart
        data={data.map((d) => ({ name: d.label, value: d.value }))}
        margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--app-border)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: 'var(--app-muted-foreground)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill="url(#areaGradient)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
