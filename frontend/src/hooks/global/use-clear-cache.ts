import { addToast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import Cookies from 'js-cookie'
import { useCallback, useState } from 'react'
import { useConfirmation } from '@/hooks/global/use-confirmation'

/** Clears all app data (query cache, localStorage, sessionStorage, cookies) and redirects to login. */
export const useClearCache = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { confirm } = useConfirmation()
  const [isClearing, setIsClearing] = useState(false)

  const clearAll = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Clear All App Data',
      message:
        'This will clear all cached data, cookies, and local storage. You will be logged out.',
      color: 'danger',
    })

    if (!confirmed) return

    setIsClearing(true)

    queryClient.clear()
    Object.keys(Cookies.get()).forEach((key) =>
      Cookies.remove(key, { path: '/' }),
    )
    localStorage.clear()
    sessionStorage.clear()

    addToast({
      title: 'App data cleared',
      description: 'All data has been wiped. Redirecting to login...',
      color: 'success',
    })

    setIsClearing(false)
    void navigate({ to: '/login' })
  }, [queryClient, navigate, confirm])

  return { clearAll, isClearing }
}
