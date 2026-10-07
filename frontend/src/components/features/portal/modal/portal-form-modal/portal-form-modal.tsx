import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { Database } from 'lucide-react'
import type { PortalFormModalProps } from '@/components/features/portal/modal/portal-form-modal/types'
import { portalModalClassNames } from '@/components/features/portal/lib/modal-styles'
import { PortalForm } from '@/components/features/portal/modal/portal-form-modal/child/portal-form'
import { usePortalFormState } from '@/hooks/portal'

import { displayValue } from '@/components/features/portal/modal/portal-form-modal/lib/portal-form-modal-helpers'

export function PortalFormModal({
  isOpen,
  onOpenChange,
  config,
  fields,
  entity,
  isReadOnly,
  isLoading = false,
  onSubmit,
}: PortalFormModalProps) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    errors,
    businessSchedule,
    timeZone,
    isConverting,
    setIsConverting,
    zoneChanged,
    isUploadingPhotos,
    setIsUploadingPhotos,
    isSlugEdited,
    setIsSlugEdited,
    extension,
    slugField,
    autoSlug,
  } = usePortalFormState({
    isOpen,
    onOpenChange,
    config,
    fields,
    entity,
    isReadOnly,
    isLoading,
    onSubmit,
  })

  return (
    <Modal
      hideCloseButton={isUploadingPhotos}
      placement="center"
      classNames={portalModalClassNames}
      isDismissable={!isUploadingPhotos && !isConverting}
      isKeyboardDismissDisabled={isUploadingPhotos || isConverting}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="4xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <Database size={20} className="text-primary" />
              <h2>
                {isReadOnly
                  ? `${config.singular} details`
                  : entity
                    ? `Edit ${config.singular}`
                    : `Create ${config.singular}`}
              </h2>
            </ModalHeader>
            <ModalBody>
              {isReadOnly ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {extension?.details(control)}
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-large border border-default-100 bg-default-50 px-4 py-3"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-widest text-default-400">
                        {field.label}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-default-700">
                        {displayValue(
                          field,
                          entity ? entity[field.key] : field.createDefault,
                          businessSchedule ? timeZone : undefined,
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-large border border-default-100 bg-default-50 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-default-400">
                      Internal ID
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-primary">
                      #{entity?.id}
                    </div>
                  </div>
                  {entity?.publicId && (
                    <div className="rounded-large border border-default-100 bg-default-50 px-4 py-3 md:col-span-2">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-default-400">
                        Public ID
                      </div>
                      <div className="mt-1 break-all font-mono text-sm font-medium text-default-700">
                        {String(entity.publicId)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <PortalForm
                  handleSubmit={handleSubmit}
                  autoSlug={autoSlug}
                  isSlugEdited={isSlugEdited}
                  slugField={slugField}
                  extension={extension}
                  zoneChanged={zoneChanged}
                  setError={setError}
                  setIsConverting={setIsConverting}
                  businessSchedule={businessSchedule}
                  timeZone={timeZone}
                  register={register}
                  control={control}
                  setValue={setValue}
                  watch={watch}
                  errors={errors}
                  setIsSlugEdited={setIsSlugEdited}
                  setIsUploadingPhotos={setIsUploadingPhotos}
                  config={config}
                  fields={fields}
                  entity={entity}
                  isLoading={isLoading}
                  onSubmit={onSubmit}
                />
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                isDisabled={isUploadingPhotos || isConverting}
                onPress={onClose}
              >
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button
                  color="primary"
                  type="submit"
                  form="portal-form"
                  isDisabled={isUploadingPhotos || isConverting}
                  isLoading={isLoading || isConverting}
                >
                  {entity ? 'Save changes' : 'Create'}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
