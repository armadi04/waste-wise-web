import {
  Avatar,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { UpdateProfileFormData } from '@/lib/schemas/users'
import type { ProfileDrawerProps } from '@/components/features/profile/drawer/profile-drawer/types'
import { Button, Drawer, Input } from '@/components/shared/controls'
import { updateProfileSchema } from '@/lib/schemas/users'
import { useAvatarCrop, useUpdateProfile } from '@/hooks/profile'
import { AvatarCropModal } from '@/components/ui/modal/avatar-crop-modal'

export function ProfileDrawer({
  isOpen,
  onOpenChange,
  user,
}: ProfileDrawerProps) {
  const [croppedFile, setCroppedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
  })

  const avatarPreview = watch('avatar')

  const avatarCrop = useAvatarCrop()

  const handleCropApply = async () => {
    const result = await avatarCrop.onApply()
    if (result) {
      setCroppedFile(result.file)
      setValue('avatar', result.previewUrl, { shouldDirty: true })
    }
  }

  useEffect(() => {
    if (user && isOpen) {
      setCroppedFile(null)
      avatarCrop.onClose()
      reset({
        fullname: user.fullname || undefined,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar?.url || null,
        password: '',
      })
    }
  }, [user, isOpen, reset])

  const updateProfileMutation = useUpdateProfile(user)

  const onSubmit = (data: UpdateProfileFormData) => {
    updateProfileMutation.mutate(
      { data, file: croppedFile },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <>
      <AvatarCropModal
        isOpen={avatarCrop.isOpen}
        imageSrc={avatarCrop.imageSrc}
        crop={avatarCrop.crop}
        completedCrop={avatarCrop.completedCrop}
        imgRef={avatarCrop.imgRef}
        onCropChange={avatarCrop.onCropChange}
        onCropComplete={avatarCrop.onCropComplete}
        onImageLoad={avatarCrop.onImageLoad}
        onApply={handleCropApply}
        onClose={avatarCrop.onClose}
        isApplying={avatarCrop.isApplying}
      />

      <Drawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="right"
        size="md"
      >
        <DrawerContent>
          {(onClose) => (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col h-full"
            >
              <DrawerHeader className="flex flex-col gap-1 border-b border-divider">
                Update Profile
              </DrawerHeader>

              <DrawerBody className="pt-6 gap-6">
                <div className="flex flex-col items-center gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={avatarCrop.onFileSelect}
                  />
                  <div
                    className="group relative cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Avatar
                      src={avatarPreview || undefined}
                      name={user?.fullname?.charAt(0)}
                      className="w-32 h-32 text-4xl transition-opacity group-hover:opacity-80"
                      isBordered
                      color="primary"
                    />
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-small text-default-500">
                    Click avatar to upload
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <Input
                    label="Email"
                    value={user?.email || ''}
                    variant="bordered"
                    isReadOnly
                    isDisabled
                    classNames={{ inputWrapper: 'bg-default-100' }}
                  />

                  <Input
                    label="Full Name"
                    placeholder="Enter your full name"
                    variant="bordered"
                    {...register('fullname')}
                    errorMessage={errors.fullname?.message}
                    isInvalid={!!errors.fullname}
                  />

                  <Input
                    label="Phone"
                    placeholder="Enter phone number"
                    variant="bordered"
                    {...register('phone')}
                    errorMessage={errors.phone?.message}
                    isInvalid={!!errors.phone}
                  />
                </div>

                <div className="mt-4 p-4 rounded-medium app-status-warning bg-[var(--app-warning-background)] text-[var(--app-warning-foreground)] border border-[var(--app-warning-border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[var(--app-warning)] font-semibold text-small uppercase tracking-wider">
                      Security Zone
                    </span>
                  </div>
                  <p className="text-tiny text-default-600 mb-3">
                    Update your password here. Please make sure you remember it!
                  </p>
                  <Input
                    label="New Password"
                    placeholder="Leave blank to keep current"
                    variant="bordered"
                    type="password"
                    classNames={{
                      inputWrapper:
                        'bg-background border-[var(--app-warning-border)] hover:border-warning-400 focus-within:border-warning-500',
                      innerWrapper: 'bg-transparent',
                    }}
                    {...register('password')}
                    errorMessage={errors.password?.message}
                    isInvalid={!!errors.password}
                  />
                </div>
              </DrawerBody>

              <DrawerFooter className="border-t border-divider">
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  type="submit"
                  isLoading={updateProfileMutation.isPending}
                  isDisabled={!isDirty && !updateProfileMutation.isPending}
                >
                  Save Changes
                </Button>
              </DrawerFooter>
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
