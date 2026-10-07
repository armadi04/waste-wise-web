export function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 px-4 rounded-large bg-default-50 border border-default-100">
      <span className="text-[10px] font-bold text-default-400 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-sm font-medium text-default-700">
        {value || 'N/A'}
      </span>
    </div>
  )
}
