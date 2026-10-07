import { Card } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

export interface QuickLinkCardProps {
  to: string
  search?: Record<string, any>
  title: string
  description: string
  icon: React.ReactNode
  color?: 'primary' | 'secondary' | 'warning'
  className?: string
}

export function QuickLinkCard({
  to,
  search,
  title,
  description,
  icon,
  color = 'primary',
  className = '',
}: QuickLinkCardProps) {
  const colorMap: Record<string, string> = {
    primary:
      'bg-[var(--app-selected-background)] text-[var(--app-link)] hover:bg-[var(--app-selected-background)]',
    secondary:
      'bg-[var(--app-selected-background)] text-[var(--app-selected-foreground)] hover:bg-[var(--app-selected-hover)]',
    warning:
      'app-status-warning bg-[var(--app-warning-background)] text-[var(--app-warning-foreground)] hover:bg-[var(--app-warning-background)]',
  }

  // Providing safe defaults
  const selectedColor = colorMap[color] || colorMap['primary']

  return (
    <Card
      className={`bg-content1 rounded-large shadow-none border border-default-200 overflow-hidden ${className}`}
    >
      <Link
        to={to}
        search={search}
        className={`flex flex-col h-full items-start p-5 transition-all duration-300 group ${selectedColor}`}
      >
        <div
          className={`w-12 h-12 rounded-large flex items-center justify-center mb-3 ${selectedColor.split(' ')[0]} ${selectedColor.split(' ')[1]} group-hover:scale-110 group-hover:shadow-small transition-all`}
        >
          {icon}
        </div>
        <div className="flex flex-col gap-1 mt-auto w-full">
          <div className="flex items-center justify-between w-full">
            <h4 className="font-semibold text-lg text-foreground group-hover:text-[var(--app-link)] transition-colors">
              {title}
            </h4>
            <ArrowRight
              size={16}
              className="text-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
            />
          </div>
          <p className="text-sm text-default-500 line-clamp-2">{description}</p>
        </div>
      </Link>
    </Card>
  )
}
