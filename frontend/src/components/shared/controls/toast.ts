import { addToast as heroAddToast } from '@heroui/react'

/** Keep status toast slots on the explicit soft status pairs in both modes. */
export function addToast(options: Parameters<typeof heroAddToast>[0]) {
  const tone = options.color ?? 'default'
  return heroAddToast({
    ...options,
    classNames: {
      ...options.classNames,
      base: `app-toast app-tone-${tone} ${options.classNames?.base ?? ''}`,
      title: `app-toast-text ${options.classNames?.title ?? ''}`,
      description: `app-toast-text ${options.classNames?.description ?? ''}`,
      icon: `app-toast-text ${options.classNames?.icon ?? ''}`,
      closeButton: `app-toast-text ${options.classNames?.closeButton ?? ''}`,
    },
  })
}
