import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { twoFactorQueryOptions } from '@/lib/query/options'
import {
  disableTwoFactor,
  enableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from '@/lib/services/two-factor.service'

/** Which panel the two-factor dialog is showing. */
export type TwoFactorStep = 'setup' | 'codes' | 'disable' | 'regenerate'

export const useTwoFactorStatus = () => useQuery(twoFactorQueryOptions())

/**
 * Drives the two-factor dialog on the profile page: enrollment (QR → code →
 * recovery codes), turning it off, and re-issuing recovery codes. Every
 * state-changing call needs a current code, so the same input serves all three.
 */
export const useTwoFactor = () => {
  const { data: status, isLoading } = useTwoFactorStatus()

  const [step, setStep] = useState<TwoFactorStep | null>(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<Array<string>>([])

  const setupMutation = useAppMutation({
    mutationFn: startTwoFactorSetup,
    onSuccess: () => setStep('setup'),
  })

  const enableMutation = useAppMutation({
    mutationFn: enableTwoFactor,
    invalidateKeys: ['two-factor'],
    successMessage: 'Two-factor authentication is on',
    onSuccess: (codes) => {
      setRecoveryCodes(codes)
      setCode('')
      setStep('codes')
    },
  })

  const disableMutation = useAppMutation({
    mutationFn: disableTwoFactor,
    invalidateKeys: ['two-factor'],
    successMessage: 'Two-factor authentication is off',
    onSuccess: () => close(),
  })

  const regenerateMutation = useAppMutation({
    mutationFn: regenerateRecoveryCodes,
    invalidateKeys: ['two-factor'],
    successMessage: 'New recovery codes issued',
    onSuccess: (codes) => {
      setRecoveryCodes(codes)
      setCode('')
      setStep('codes')
    },
  })

  function close() {
    setStep(null)
    setCode('')
    setRecoveryCodes([])
  }

  const startSetup = () => setupMutation.mutate(undefined)
  const startDisable = () => {
    setCode('')
    setStep('disable')
  }
  const startRegenerate = () => {
    setCode('')
    setStep('regenerate')
  }

  return {
    status,
    isLoading,
    step,
    close,
    code,
    setCode,
    recoveryCodes,
    enrollment: setupMutation.data,
    startSetup,
    startDisable,
    startRegenerate,
    isStarting: setupMutation.isPending,
    confirm: () => enableMutation.mutate(code.trim()),
    isConfirming: enableMutation.isPending,
    disable: () => disableMutation.mutate(code.trim()),
    isDisabling: disableMutation.isPending,
    regenerate: () => regenerateMutation.mutate(code.trim()),
    isRegenerating: regenerateMutation.isPending,
  }
}
