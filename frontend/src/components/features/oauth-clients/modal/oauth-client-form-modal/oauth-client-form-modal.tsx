import {
  Divider,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { OAuthClientFormData } from '@/lib/schemas/oauth-clients'
import type { OAuthClientFormModalProps } from '@/components/features/oauth-clients/modal/oauth-client-form-modal/types'
import {
  Button,
  Chip,
  Input,
  Modal,
  Select,
  SelectItem,
  Switch,
} from '@/components/shared/controls'
import { oauthClientSchema } from '@/lib/schemas/oauth-clients'

import {
  CopyField,
  DetailRow,
} from '@/components/features/oauth-clients/modal/oauth-client-form-modal/child'

export function OAuthClientFormModal({
  isOpen,
  onOpenChange,
  editingClient,
  onSubmit,
  isLoading = false,
  isReadOnly = false,
  scopeOptions,
  createdSecret,
}: OAuthClientFormModalProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<OAuthClientFormData>({
    resolver: zodResolver(oauthClientSchema),
  })

  const [showInactive, setShowInactive] = useState(true)

  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        reset({
          name: editingClient.name,
          scopes: editingClient.scopes ?? [],
          isActive: editingClient.isActive,
        })
        setShowInactive(editingClient.isActive)
      } else {
        reset({ name: '', scopes: [], isActive: true })
        setShowInactive(true)
      }
    }
  }, [isOpen, editingClient, reset])

  const title = createdSecret
    ? 'Client Secret'
    : isReadOnly
      ? 'OAuth Client Details'
      : editingClient
        ? 'Edit OAuth Client'
        : 'Create OAuth Client'

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex gap-2 items-center">
              <KeyRound size={20} className="text-[var(--app-link)]" />
              <span>{title}</span>
            </ModalHeader>

            <ModalBody className="pb-6">
              {createdSecret ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 py-3 px-4 rounded-large app-status-warning bg-[var(--app-warning-background)] text-[var(--app-warning-foreground)] border border-[var(--app-warning-border)] text-[var(--app-warning-foreground)]">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <span className="text-sm font-medium">
                      Copy this secret now — it is shown only once and cannot be
                      retrieved again.
                    </span>
                  </div>
                  <CopyField label="Client ID" value={createdSecret.clientId} />
                  <CopyField
                    label="Client Secret"
                    value={createdSecret.clientSecret}
                  />
                </div>
              ) : isReadOnly ? (
                <div className="flex flex-col gap-3">
                  <DetailRow label="Name" value={editingClient?.name} />
                  <DetailRow
                    label="Client ID"
                    value={editingClient?.clientId}
                    mono
                  />
                  <DetailRow
                    label="Status"
                    value={editingClient?.isActive ? 'Active' : 'Inactive'}
                  />
                  {editingClient?.scopes?.length ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-default-400 uppercase tracking-widest whitespace-nowrap">
                          Granted Scopes
                        </span>
                        <Divider className="flex-1" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                        {editingClient.scopes.map((s) => (
                          <Chip
                            key={s}
                            size="sm"
                            variant="flat"
                            color="primary"
                            className="font-medium"
                          >
                            {s}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <form
                  id="oauth-client-form"
                  onSubmit={handleSubmit(onSubmit)}
                  className="flex flex-col gap-3"
                >
                  <Input
                    {...register('name')}
                    label="Client Name"
                    placeholder="e.g. Mobile App Backend"
                    variant="bordered"
                    labelPlacement="outside"
                    errorMessage={errors.name?.message}
                    isInvalid={!!errors.name}
                  />
                  <Controller
                    control={control}
                    name="scopes"
                    render={({ field }) => (
                      <Select
                        label="Scopes"
                        placeholder="Select the permissions this client may request"
                        variant="bordered"
                        labelPlacement="outside"
                        selectionMode="multiple"
                        description="A client may only be granted scopes you hold."
                        selectedKeys={new Set(field.value ?? [])}
                        onSelectionChange={(keys) =>
                          field.onChange(Array.from(keys as Set<string>))
                        }
                        errorMessage={errors.scopes?.message}
                        isInvalid={!!errors.scopes}
                      >
                        {scopeOptions.map((scope) => (
                          <SelectItem key={scope}>{scope}</SelectItem>
                        ))}
                      </Select>
                    )}
                  />
                  {editingClient && (
                    <Controller
                      control={control}
                      name="isActive"
                      render={({ field }) => (
                        <Switch
                          isSelected={showInactive}
                          onValueChange={(v) => {
                            setShowInactive(v)
                            field.onChange(v)
                          }}
                        >
                          Active
                        </Switch>
                      )}
                    />
                  )}
                </form>
              )}
            </ModalBody>

            <ModalFooter>
              {createdSecret ? (
                <Button
                  color="primary"
                  onPress={onClose}
                  className="px-8 font-medium"
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="flat"
                    onPress={onClose}
                    className="font-medium"
                  >
                    {isReadOnly ? 'Close' : 'Cancel'}
                  </Button>
                  {!isReadOnly && (
                    <Button
                      color="primary"
                      type="submit"
                      form="oauth-client-form"
                      isLoading={isLoading}
                      className="px-8 font-medium"
                    >
                      {editingClient ? 'Save Changes' : 'Create Client'}
                    </Button>
                  )}
                </>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
