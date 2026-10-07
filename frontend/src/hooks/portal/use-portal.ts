import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useShallow } from 'zustand/react/shallow'
import type {
  CampaignAdjustmentInput,
  WalletAdjustmentInput,
} from '@/lib/services/portal.service'
import type { PortalRecord, PortalResource, PortalValue } from '@/types/portal'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useAppMutation } from '@/hooks/global/use-mutations'

import {
  portalCapabilities,
  portalResourceConfig,
} from '@/components/features/portal/lib/config'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import { portalRecordsQueryOptions } from '@/lib/query/options'
import {
  adjustPortalCampaignPoints,
  adjustPortalWallet,
  approvePortalRefund,
  bulkDeletePortalRecords,
  createPortalRecord,
  deletePortalRecord,
  rejectPortalRefund,
  revokePortalGift,
  updatePortalRecord,
  verifyPortalPass,
} from '@/lib/services/portal.service'
import { useAuthStore } from '@/lib/stores/auth.store'
import { usePortalUiStore } from '@/lib/stores/portal-ui.store'
import { preparePortalMutation } from '@/lib/utils/portal-form'

const routeApi = getRouteApi('/(portal)/portal/$resource')

export const usePortalRecords = (resource: PortalResource) => {
  const { page, limit, search, sort, direction } = routeApi.useSearch()

  return useQuery({
    ...portalRecordsQueryOptions(resource, {
      page,
      limit,
      search,
      sort,
      direction,
    }),
    enabled: useAuthStore(
      (state) =>
        state.user?.permissions.includes(
          `${portalResourceConfig(resource)?.permission}.read`,
        ) ?? false,
    ),
  })
}

export const usePortalPage = () => {
  const { resource: rawResource } = routeApi.useParams()
  const resource = rawResource as PortalResource
  const config = portalResourceConfig(resource)
  const tableState = useDataTable(routeApi)
  const { data, isLoading, isError, error, refetch } =
    usePortalRecords(resource)
  const { hasPermission } = useUserPermission()
  const { confirm } = useConfirmation()
  const ui = usePortalUiStore(
    useShallow((state) => ({
      open: state.open,
      close: state.close,
      onOpenChange: state.onOpenChange,
      isReadOnly: state.isReadOnly,
      refundRejectOpen: state.modals.refundReject.isOpen,
      refundRejectEntity: state.modals.refundReject.entity,
      adjustPointsOpen: state.modals.adjustPoints.isOpen,
      adjustPointsEntity: state.modals.adjustPoints.entity,
      giftRevokeOpen: state.modals.giftRevoke.isOpen,
      giftRevokeEntity: state.modals.giftRevoke.entity,
      walletAdjustOpen: state.modals.walletAdjust.isOpen,
      walletAdjustEntity: state.modals.walletAdjust.entity,
      formOpen: state.modals.form.isOpen,
      formEntity: state.modals.form.entity,
    })),
  )

  const capabilities = portalCapabilities(config)
  const prefix = config?.permission ?? `portal.${resource}`
  const fields = config?.fields ?? []

  const createMutation = useAppMutation({
    mutationFn: (formData: Record<string, PortalValue>) =>
      createPortalRecord(
        resource,
        preparePortalMutation(formData, config!, 'create'),
      ),
    invalidateKeys: ['portal', resource],
    successMessage: `${config?.singular ?? 'Portal record'} created successfully`,
    onSuccess: () => ui.close('form'),
  })

  const updateMutation = useAppMutation({
    mutationFn: ({
      id,
      data: formData,
    }: {
      id: number
      data: Record<string, PortalValue>
    }) =>
      updatePortalRecord(
        resource,
        id,
        preparePortalMutation(formData, config!, 'update', ui.formEntity ?? {}),
      ),
    invalidateKeys: ['portal', resource],
    successMessage: `${config?.singular ?? 'Portal record'} updated successfully`,
    onSuccess: () => ui.close('form'),
  })

  const deleteMutation = useAppMutation({
    mutationFn: (id: number) => deletePortalRecord(resource, id),
    invalidateKeys: ['portal', resource],
    successMessage: `${config?.singular ?? 'Portal record'} deleted successfully`,
  })

  const bulkDeleteMutation = useAppMutation({
    mutationFn: (ids: Array<number>) => bulkDeletePortalRecords(resource, ids),
    invalidateKeys: ['portal', resource],
    successMessage: `${config?.label ?? 'Portal records'} deleted successfully`,
  })

  const approveRefund = useAppMutation({
    mutationFn: (id: number) => approvePortalRefund(id),
    invalidateKeys: [['portal'], ['notifications']],
    successMessage: 'Refund approved successfully',
  })

  const handleApproveRefund = async (record: PortalRecord) => {
    if (!hasPermission('portal.orders.refund') || approveRefund.isPending)
      return
    if (
      await confirm({
        title: 'Approve refund?',
        message: `Refund ${String(record.orderNumber)} for ${String(record.total)} IDR. The backend will recheck that no pass has been used.`,
        color: 'danger',
      })
    )
      approveRefund.mutate(record.id)
  }

  const rejectRefund = useAppMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      rejectPortalRefund(id, reason),
    invalidateKeys: [['portal'], ['notifications']],
    successMessage: 'Refund rejected',
  })
  const handleRejectRefund = (record: PortalRecord) => {
    if (!hasPermission('portal.orders.refund') || rejectRefund.isPending) return
    ui.open('refundReject', record)
  }

  const verifyPass = useAppMutation({
    mutationFn: ({ kind, id }: { kind: 'voucher' | 'ticket'; id: number }) =>
      verifyPortalPass(kind, id),
    invalidateKeys: [['portal'], ['notifications']],
    successMessage:
      resource === 'tickets' ? 'Ticket checked in' : 'Voucher redeemed',
  })
  const handleVerifyPass = async (record: PortalRecord) => {
    const kind = resource === 'tickets' ? 'ticket' : 'voucher'
    if (
      !hasPermission(
        kind === 'ticket'
          ? 'portal.tickets.check_in'
          : 'portal.vouchers.redeem',
      ) ||
      verifyPass.isPending
    )
      return
    if (
      await confirm({
        title: kind === 'ticket' ? 'Check in ticket?' : 'Redeem voucher?',
        message: `${String(record.code)} will be marked ${kind === 'ticket' ? 'checked in' : 'redeemed'}. This cannot be undone.`,
        color: 'primary',
      })
    )
      verifyPass.mutate({ kind, id: record.id })
  }

  const adjustPoints = useAppMutation({
    mutationFn: (data: CampaignAdjustmentInput) =>
      adjustPortalCampaignPoints(data),
    invalidateKeys: [['portal']],
    successMessage: 'Campaign points adjusted',
    onSuccess: () => ui.close('adjustPoints'),
  })
  const handleAdjustPoints = (record: PortalRecord) => {
    if (!hasPermission('portal.campaign_progress.adjust')) return
    ui.open('adjustPoints', record)
  }

  const revokeGift = useAppMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      revokePortalGift(id, reason),
    invalidateKeys: [['portal']],
    successMessage: 'Gift revoked',
    onSuccess: () => ui.close('giftRevoke'),
  })
  const handleRevokeGift = (record: PortalRecord) => {
    if (hasPermission('portal.gifts.revoke')) ui.open('giftRevoke', record)
  }

  const adjustWallet = useAppMutation({
    mutationFn: (input: WalletAdjustmentInput) => adjustPortalWallet(input),
    invalidateKeys: [['portal']],
    successMessage: 'Wallet balance adjusted',
    onSuccess: () => ui.close('walletAdjust'),
  })
  const handleAdjustWallet = (record: PortalRecord) => {
    if (hasPermission('portal.wallets.adjust')) ui.open('walletAdjust', record)
  }

  const handleDelete = async (id: number) => {
    if (
      await confirm({
        title: `Delete ${config?.singular ?? 'record'}`,
        message: 'This record will be soft-deleted.',
        color: 'danger',
      })
    ) {
      deleteMutation.mutate(id)
    }
  }

  const handleBulkDelete = async (ids: Array<number>, clear: () => void) => {
    if (
      await confirm({
        title: `Delete ${ids.length} record(s)?`,
        message: 'This action uses soft delete.',
        color: 'danger',
      })
    ) {
      bulkDeleteMutation.mutate(ids, { onSuccess: clear })
    }
  }

  return {
    rejectRefund,
    handleRejectRefund,
    handleVerifyPass,
    verifyingPass: verifyPass.isPending,
    adjustPoints,
    handleAdjustPoints,
    capabilities,
    revokeGift,
    handleRevokeGift,
    adjustWallet,
    handleAdjustWallet,
    resource,
    config,
    data,
    isLoading,
    isError,
    error,
    refetch,
    fields,
    prefix,
    hasPermission,
    tableState,
    ui,
    handleApproveRefund,
    approvingRefund: approveRefund.isPending,
    tableProps: {
      data,
      isLoading,
      ...tableState,
      initialSearch: tableState.search,
      onCreate:
        capabilities.create && hasPermission(`${prefix}.create`)
          ? () => ui.open('form', null)
          : undefined,
      onDelete: handleDelete,
      onBulkDelete:
        capabilities.bulkDelete && hasPermission(`${prefix}.delete`)
          ? handleBulkDelete
          : undefined,
      canCreate: capabilities.create && hasPermission(`${prefix}.create`),
      canUpdate: capabilities.update && hasPermission(`${prefix}.update`),
      canDelete: capabilities.delete && hasPermission(`${prefix}.delete`),
    },
    modalProps: {
      isOpen: ui.formOpen,
      onOpenChange: ui.onOpenChange('form'),
      entity: ui.formEntity,
      isReadOnly: ui.isReadOnly,
      isLoading: createMutation.isPending || updateMutation.isPending,
      onSubmit: (formData: Record<string, PortalValue>) => {
        if (ui.formEntity)
          updateMutation.mutate({ id: ui.formEntity.id, data: formData })
        else createMutation.mutate(formData)
      },
    },
  }
}
