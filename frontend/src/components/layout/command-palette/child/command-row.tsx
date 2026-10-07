import type { Command } from '@/hooks/global'

export const CommandRow = ({
  command,
  isActive,
  onHover,
  onRun,
}: {
  command: Command
  isActive: boolean
  onHover: () => void
  onRun: () => void
}) => (
  <button
    type="button"
    onMouseMove={onHover}
    onClick={onRun}
    className={`flex w-full items-center gap-3 rounded-large px-3 py-2 text-left text-sm transition-colors ${
      isActive ? 'bg-default-100' : ''
    } ${command.isDanger ? 'text-danger' : 'text-default-700'}`}
  >
    <span
      className={`shrink-0 ${command.isDanger ? 'text-danger' : 'text-default-500'}`}
    >
      {command.icon}
    </span>
    <span className="flex-1 truncate">{command.label}</span>
    {command.hint ? (
      <span className="shrink-0 text-xs text-default-400">{command.hint}</span>
    ) : null}
  </button>
)
