import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReportFormValues } from '@/lib/schemas/reports'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/shared/controls'
import { ReportForm } from '@/components/features/reports/components/report-form'
import { useCreateReportMutation } from '@/hooks/reports'

export function ReportCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateReportMutation()

  const handleSubmit = async (values: ReportFormValues, photo?: File) => {
    if (!photo) return
    const report = await createMutation.mutateAsync({ values, photo })
    void navigate({
      to: '/reports/$reportId',
      params: { reportId: String(report.id) },
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="New Report"
        description="Upload a waste photo and describe the condition."
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'New', isCurrent: true },
        ]}
        actions={
          <Button
            variant="light"
            startContent={<ArrowLeft size={16} />}
            onPress={() => void navigate({ to: '/reports' })}
          >
            Back
          </Button>
        }
      />
      <div className="rounded-large border border-default-200 bg-content1 p-5">
        <ReportForm
          mode="create"
          isSubmitting={createMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => void navigate({ to: '/reports' })}
        />
      </div>
    </div>
  )
}
