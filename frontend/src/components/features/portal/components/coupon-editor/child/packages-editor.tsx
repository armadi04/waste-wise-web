import { Button, Checkbox, Input, Textarea } from '@heroui/react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { CouponPackageInput } from '@/types/portal'
import { reorder } from '@/components/features/portal/components/coupon-editor/lib/coupon-editor-helpers'

export function PackagesEditor({
  value,
  onChange,
  readOnly,
}: {
  value: Array<CouponPackageInput>
  onChange: (value: Array<CouponPackageInput>) => void
  readOnly: boolean
}) {
  const update = (index: number, changes: Partial<CouponPackageInput>) =>
    onChange(
      value.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    )
  return (
    <section className="col-span-full grid gap-3 rounded-xl border border-default-200 p-4">
      <h3 className="font-semibold">Coupon packages</h3>
      <p className="text-sm text-default-500">
        Each package has its own stock. Updating total stock preserves issued
        vouchers. Removed packages are deactivated.
      </p>
      {value.map((item, index) => (
        <div
          key={item.publicId ?? index}
          className="grid gap-3 rounded-lg bg-default-50 p-4 sm:grid-cols-2"
        >
          <Input
            label={`Package ${index + 1} name`}
            value={item.name}
            onValueChange={(name) => update(index, { name })}
            isReadOnly={readOnly}
            isRequired
            className="sm:col-span-2"
          />
          <Textarea
            label="What's included"
            value={item.benefits}
            onValueChange={(benefits) => update(index, { benefits })}
            isReadOnly={readOnly}
            className="sm:col-span-2"
          />
          <Input
            label="Price (IDR)"
            type="number"
            min={0}
            step={1}
            value={String(item.price)}
            onValueChange={(price) => update(index, { price: Number(price) })}
            isReadOnly={readOnly}
            isRequired
          />
          <Input
            label="Original price (optional)"
            type="number"
            min={0}
            step={1}
            value={item.oldPrice === null ? '' : String(item.oldPrice)}
            onValueChange={(price) =>
              update(index, { oldPrice: price === '' ? null : Number(price) })
            }
            isReadOnly={readOnly}
          />
          <Input
            label={`Package ${index + 1} total stock`}
            type="number"
            min={Math.max(0, item.issuedStock ?? 0)}
            step={1}
            value={String(item.stockTotal)}
            onValueChange={(stock) =>
              update(index, { stockTotal: Number(stock) })
            }
            isReadOnly={readOnly}
            isRequired
          />
          <p className="self-center text-sm text-default-500">
            Remaining: {Math.max(0, item.stockTotal - (item.issuedStock ?? 0))}
          </p>
          <Checkbox
            isSelected={item.active}
            onValueChange={(active) => update(index, { active })}
            isDisabled={readOnly}
          >
            Active
          </Checkbox>
          {!readOnly && (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                isIconOnly
                size="sm"
                aria-label={`Move package ${index + 1} up`}
                isDisabled={index === 0}
                onPress={() => onChange(reorder(value, index, -1))}
              >
                <ArrowUp size={15} />
              </Button>
              <Button
                type="button"
                isIconOnly
                size="sm"
                aria-label={`Move package ${index + 1} down`}
                isDisabled={index === value.length - 1}
                onPress={() => onChange(reorder(value, index, 1))}
              >
                <ArrowDown size={15} />
              </Button>
              <Button
                type="button"
                isIconOnly
                size="sm"
                color="danger"
                aria-label={`Remove package ${index + 1}`}
                onPress={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button
          type="button"
          variant="flat"
          isDisabled={value.length >= 30}
          onPress={() =>
            onChange([
              ...value,
              {
                name: '',
                benefits: '',
                price: 0,
                oldPrice: null,
                stockTotal: 0,
                active: true,
              },
            ])
          }
        >
          <Plus size={16} />
          Add package
        </Button>
      )}
    </section>
  )
}
