import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { PortalRecord } from '@/types/portal'
import { PortalRequestErrorState } from '@/components/features/portal/components/request-error'
import { getPortalColumns } from '@/components/features/portal/components/table-columns'
import { CampaignAdjustModal } from '@/components/features/portal/modal/campaign-adjust-modal'
import { PortalFormModal } from '@/components/features/portal/modal/portal-form-modal'
import { PortalRelationsModal } from '@/components/features/portal/modal/portal-relations-modal'
import { ReasonModal } from '@/components/features/portal/modal/reason-modal'
import { RefundRejectModal } from '@/components/features/portal/modal/refund-reject-modal'
import { WalletAdjustModal } from '@/components/features/portal/modal/wallet-adjust-modal'
import { CUSTOMER_KEY } from '@/components/features/portal/pages/portal-resource/lib/portal-resource-page-helpers'
import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { usePortalPage } from '@/hooks/portal'

export function PortalResourcePage() {
  const page = usePortalPage()
  const { config } = page
  const [relationOwner, setRelationOwner] = useState<PortalRecord | null>(null)
  const navigate = useNavigate()

  if (!config) return null

  const handleView = (record: PortalRecord) =>
    page.ui.open('form', record, { readOnly: true })
  const handleEdit = (record: PortalRecord) => page.ui.open('form', record)
  const relationKind =
    config.resource === 'events'
      ? 'event-tickets'
      : config.resource === 'orders'
        ? 'order-items'
        : null
  const columns = getPortalColumns({
    config,
    fields: page.fields,
    onView: handleView,
    onEdit: handleEdit,
    onDelete: page.tableProps.onDelete,
    hasPermission: page.hasPermission,
    onApproveRefund:
      config.resource === 'orders' ? page.handleApproveRefund : undefined,
    approvingRefund: page.approvingRefund,
    onRejectRefund:
      config.resource === 'orders' ? page.handleRejectRefund : undefined,
    onManageRelation: relationKind ? setRelationOwner : undefined,
    onVerifyPass:
      config.resource === 'vouchers' || config.resource === 'tickets'
        ? page.handleVerifyPass
        : undefined,
    verifyingPass: page.verifyingPass,
    onAdjustPoints:
      config.resource === 'campaign-progress'
        ? page.handleAdjustPoints
        : undefined,
    onRevokeGift:
      config.resource === 'gifts' ? page.handleRevokeGift : undefined,
    onAdjustWallet:
      config.resource === 'wallets' ? page.handleAdjustWallet : undefined,
    onOpenCustomer: CUSTOMER_KEY[config.resource]
      ? (record) => {
          void navigate({
            to: '/portal/customers/$customerId',
            params: {
              customerId: String(record[CUSTOMER_KEY[config.resource] ?? 'id']),
            },
          })
        }
      : undefined,
  })

  return (
    <div>
      <PageHeader
        title={config.label}
        breadcrumbs={[
          { label: 'Portal', href: '/portal' },
          { label: config.label, isCurrent: true },
        ]}
      />
      {page.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : page.isError ? (
        <PortalRequestErrorState
          error={page.error}
          onRetry={() => {
            void page.refetch()
          }}
        />
      ) : (
        <DataTable {...page.tableProps} columns={columns} />
      )}
      <RefundRejectModal
        isOpen={page.ui.refundRejectOpen}
        record={page.ui.refundRejectEntity}
        busy={page.rejectRefund.isPending}
        onClose={() => page.ui.close('refundReject')}
        onSubmit={(reason) => {
          if (page.ui.refundRejectEntity)
            page.rejectRefund.mutate(
              { id: page.ui.refundRejectEntity.id, reason },
              { onSuccess: () => page.ui.close('refundReject') },
            )
        }}
      />
      <CampaignAdjustModal
        isOpen={page.ui.adjustPointsOpen}
        record={page.ui.adjustPointsEntity}
        busy={page.adjustPoints.isPending}
        onClose={() => page.ui.close('adjustPoints')}
        onSubmit={(data) => page.adjustPoints.mutate(data)}
      />
      <ReasonModal
        isOpen={page.ui.giftRevokeOpen}
        title={`Revoke gift ${String(page.ui.giftRevokeEntity?.code ?? '')}`}
        description="The gift link stops working and its reserved package stock is returned. Redeemed gifts cannot be revoked."
        confirmLabel="Revoke gift"
        busy={page.revokeGift.isPending}
        onClose={() => page.ui.close('giftRevoke')}
        onSubmit={(reason) => {
          if (page.ui.giftRevokeEntity)
            page.revokeGift.mutate({ id: page.ui.giftRevokeEntity.id, reason })
        }}
      />
      <WalletAdjustModal
        isOpen={page.ui.walletAdjustOpen}
        userId={
          page.ui.walletAdjustEntity
            ? Number(page.ui.walletAdjustEntity.userId)
            : null
        }
        balance={Number(page.ui.walletAdjustEntity?.balance ?? 0)}
        busy={page.adjustWallet.isPending}
        onClose={() => page.ui.close('walletAdjust')}
        onSubmit={(data) => page.adjustWallet.mutate(data)}
      />
      <PortalFormModal
        {...page.modalProps}
        config={config}
        fields={page.fields}
      />
      <PortalRelationsModal
        isOpen={relationOwner !== null}
        onOpenChange={(open) => {
          if (!open) setRelationOwner(null)
        }}
        kind={relationKind}
        ownerId={relationOwner?.id ?? null}
        ownerPaid={
          Boolean(relationOwner?.paidAt) || relationOwner?.status !== 'Pending'
        }
      />
    </div>
  )
}
