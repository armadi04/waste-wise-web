import { Turnstile } from '@marsidev/react-turnstile'
import { useCallback, useEffect, useRef } from 'react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import type { RefObject } from 'react'
import { useClientReady, useTheme } from '@/hooks/global'

interface TurnstileWidgetProps {
  widgetRef: RefObject<TurnstileInstance | null>
  onSuccess: (token: string) => void
  onExpire: () => void
  onError: () => void
  onScriptError: () => void
  onInvalidate: () => void
}

export function TurnstileWidget(props: TurnstileWidgetProps) {
  const ready = useClientReady()
  const { isDark } = useTheme()
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const loadedTheme = useRef<boolean | undefined>(undefined)
  const stopTimer = useCallback(() => clearTimeout(timer.current), [])
  const onWidgetLoad = useCallback(() => {
    loadedTheme.current = isDark
    stopTimer()
  }, [isDark, stopTimer])
  const { onInvalidate, onScriptError } = props
  useEffect(() => {
    if (!ready || !siteKey) return
    onInvalidate()
    if (loadedTheme.current !== isDark)
      timer.current = setTimeout(onScriptError, 15_000)
    return () => {
      stopTimer()
      onInvalidate()
    }
  }, [ready, isDark, onInvalidate, onScriptError, stopTimer])
  if (!ready || !siteKey) return null

  return (
    <Turnstile
      ref={props.widgetRef}
      siteKey={siteKey}
      onSuccess={props.onSuccess}
      onExpire={props.onExpire}
      onError={props.onError}
      onTimeout={props.onExpire}
      onUnsupported={props.onError}
      onWidgetLoad={onWidgetLoad}
      scriptOptions={{ onError: props.onScriptError }}
      options={{
        theme: isDark ? 'dark' : 'light',
        size: 'normal',
        action: 'admin-login',
      }}
    />
  )
}
