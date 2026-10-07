export function getCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find((item) => item.startsWith('csrfToken='))
      ?.slice('csrfToken='.length) ?? ''
  )
}
