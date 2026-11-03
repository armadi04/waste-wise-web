import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DistributionPoint } from '@/components/features/dashboard/components/distribution-chart'

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

export default function DistributionChartGraph({
  data,
}: {
  data: Array<DistributionPoint>
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data.map((item) => ({
          name: item.label,
          value: item.value,
          color: item.color,
        }))}
        margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
      >
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
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: 'var(--app-muted-foreground)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((item) => (
            <Cell key={item.label} fill={item.color ?? 'var(--app-primary)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
