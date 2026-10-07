export function Stat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-large border border-default-100 bg-default-50 px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-default-400">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-default-700">
        {value}
      </div>
    </div>
  )
}
