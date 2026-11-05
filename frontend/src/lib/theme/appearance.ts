/**
 * Keep the browser chrome color in sync with the resolved theme and background
 * preference. Reads the DOM (theme class + `data-background`) so both stores can
 * call it without importing each other.
 */
export const syncThemeColor = () => {
  if (typeof document === 'undefined') return
  const isDark = document.documentElement.classList.contains('dark')
  const background = document.documentElement.getAttribute('data-background')
  const color = isDark
    ? '#000000'
    : background === 'gray'
      ? '#f5f5f7'
      : '#ffffff'

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', color)
}
