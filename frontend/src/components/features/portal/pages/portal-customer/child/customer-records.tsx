import {
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import type { usePortalCustomerPage } from '@/hooks/portal'
import type { CUSTOMER_TABS } from '@/lib/schemas/portal'
import { PortalRequestErrorState } from '@/components/features/portal/components/request-error'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import { cell } from '@/components/features/portal/pages/portal-customer/lib/portal-customer-page-helpers'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'

export function CustomerRecords({
  tab,
  page,
  onPageChange,
  records,
}: {
  tab: (typeof CUSTOMER_TABS)[number]
  page: number
  onPageChange: (page: number) => void
  records: ReturnType<typeof usePortalCustomerPage>['records']
}) {
  const config = portalResourceConfig(tab)
  if (!config) return null
  const fields = config.fields
    .filter((field) => field.key !== 'userId' && field.type !== 'textarea')
    .slice(0, 5)
  if (records.isLoading)
    return <TableSkeleton rows={5} columns={fields.length + 1} />
  if (records.isError)
    return (
      <PortalRequestErrorState
        error={records.error}
        onRetry={() => {
          void records.refetch()
        }}
      />
    )
  const rows = records.data?.data ?? []
  const lastPage = records.data?.meta.lastPage ?? 1
  return (
    <div className="grid gap-3">
      <Table aria-label={`${config.label} for customer`} removeWrapper>
        <TableHeader>
          {[
            <TableColumn key="id">ID</TableColumn>,
            ...fields.map((field) => (
              <TableColumn key={field.key}>{field.label}</TableColumn>
            )),
            <TableColumn key="createdAt">Created</TableColumn>,
          ]}
        </TableHeader>
        <TableBody emptyContent={`No ${config.label.toLowerCase()}.`}>
          {rows.map((record) => (
            <TableRow key={record.id}>
              {[
                <TableCell key="id">#{record.id}</TableCell>,
                ...fields.map((field) => (
                  <TableCell key={field.key}>
                    {cell(record, field.key, field.type)}
                  </TableCell>
                )),
                <TableCell key="createdAt">
                  {cell(record, 'createdAt', 'datetime')}
                </TableCell>,
              ]}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {lastPage > 1 && (
        <Pagination
          className="self-center"
          total={lastPage}
          page={page}
          onChange={onPageChange}
        />
      )}
    </div>
  )
}
