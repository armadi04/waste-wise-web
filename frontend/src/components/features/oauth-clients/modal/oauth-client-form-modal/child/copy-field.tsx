import { Button, addToast } from '@heroui/react'
import { Copy } from 'lucide-react'

export function CopyField({ label, value }: { label: string; value: string }) {
  const copy = () => {
    void navigator.clipboard.writeText(value)
    addToast({ title: `${label} copied`, color: 'success' })
  }
  return (
    <div className="flex flex-col gap-1 py-3 px-4 rounded-large bg-default-50 border border-default-100">
      <span className="text-[10px] font-bold text-default-400 uppercase tracking-widest">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-default-700 break-all flex-1">
          {value}
        </span>
        <Button isIconOnly size="sm" variant="flat" onPress={copy}>
          <Copy size={14} />
        </Button>
      </div>
    </div>
  )
}
