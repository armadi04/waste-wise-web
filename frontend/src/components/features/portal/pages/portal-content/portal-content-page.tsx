import { Card, CardBody, Listbox, ListboxItem } from '@heroui/react'
import { ContentEditor } from '@/components/features/portal/components/content-editor'
import { PortalRequestErrorState } from '@/components/features/portal/components/request-error'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { usePortalContentPage } from '@/hooks/portal'

export function PortalContentPage() {
  const page = usePortalContentPage()
  return (
    <div>
      <PageHeader
        title="Site content"
        description="Legal pages, home copy, help contact and status notice shown on the portal."
        breadcrumbs={[
          { label: 'Portal', href: '/portal' },
          { label: 'Site content', isCurrent: true },
        ]}
      />
      {!page.canRead ? (
        <Card>
          <CardBody className="text-sm text-default-500">
            No portal content permission.
          </CardBody>
        </Card>
      ) : page.query.isError ? (
        <PortalRequestErrorState
          error={page.query.error}
          onRetry={() => {
            void page.query.refetch()
          }}
        />
      ) : page.query.isLoading || !page.selected ? (
        <TableSkeleton rows={6} columns={2} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Card className="border border-default-100 self-start">
            <CardBody className="p-2">
              <Listbox
                aria-label="Content entries"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[page.selected.key]}
                onAction={(key) => page.onSelect(String(key))}
              >
                {page.entries.map((entry) => (
                  <ListboxItem
                    key={entry.key}
                    description={
                      entry.published
                        ? 'Published'
                        : entry.saved
                          ? 'Draft'
                          : 'Built-in copy'
                    }
                  >
                    {entry.title}
                  </ListboxItem>
                ))}
              </Listbox>
            </CardBody>
          </Card>
          <ContentEditor
            entry={page.selected}
            canUpdate={page.canUpdate}
            busy={page.save.isPending}
            onSave={(data) =>
              page.save.mutate({ key: page.selected!.key, data })
            }
          />
        </div>
      )}
    </div>
  )
}
