import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateProfileFormData } from '@/lib/schemas/users'
import type { UserProfile } from '@/types/auth'
import { addToast } from '@/components/shared/controls/toast'
import { apiPatch } from '@/lib/api'

export const useUpdateProfile = (user: UserProfile | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      data,
      file,
    }: {
      data: UpdateProfileFormData
      file: File | null
    }) => {
      if (!user?.id) throw new Error('User ID not found')

      // Prepare payload
      const payload = { ...data }
      if (!payload.password) delete payload.password

      if (file) {
        const formData = new FormData()

        // Append text fields
        Object.entries(payload).forEach(([key, value]) => {
          if (
            key !== 'avatar' &&
            value !== undefined &&
            value !== null &&
            value !== ''
          ) {
            formData.append(key, value)
          }
        })

        // Append file
        formData.append('avatar', file)

        return apiPatch<UserProfile>(`/api/users/${user.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      return apiPatch<UserProfile>(`/api/users/${user.id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      addToast({
        title: 'Success',
        description: 'Profile updated successfully',
        color: 'primary',
      })
    },
    onError: (error: any) => {
      addToast({
        title: 'Error',
        description:
          error.response?.data?.message || 'Failed to update profile',
        color: 'danger',
      })
    },
  })
}
