import { addToast } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { UseMutationOptions } from '@tanstack/react-query'

interface MutationHelperOptions<
  TData,
  TError,
  TVariables,
  TContext,
> extends UseMutationOptions<TData, TError, TVariables, TContext> {
  invalidateKeys?: Array<string | Array<unknown>>
  successMessage?: string
  errorMessage?: string
}

export function useAppMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(options: MutationHelperOptions<TData, TError, TVariables, TContext>) {
  const queryClient = useQueryClient()
  const { invalidateKeys, successMessage, errorMessage, ...rest } = options

  return useMutation({
    ...rest,
    onSuccess: (data, variables, context) => {
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({
            queryKey: Array.isArray(key) ? key : [key],
          })
        })
      }

      if (successMessage) {
        addToast({
          title: 'Success',
          description: successMessage,
          color: 'primary',
        })
      }

      if (options.onSuccess) {
        // @ts-ignore - Handle TanStack Query signature differences
        options.onSuccess(data, variables, context)
      }
    },
    onError: (error: TError, variables, context) => {
      let message = errorMessage || 'An error occurred'

      if (axios.isAxiosError(error)) {
        message = error.response?.data?.message || error.message || message
      } else if (error instanceof Error) {
        message = error.message
      }

      addToast({
        title: 'Error',
        description: message,
        color: 'danger',
      })

      if (options.onError) {
        // @ts-ignore - Handle TanStack Query signature differences
        options.onError(error, variables, context)
      }
    },
  })
}
