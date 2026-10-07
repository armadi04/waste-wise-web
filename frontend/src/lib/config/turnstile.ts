const TEST_SITE_KEYS = [
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
]

export function validateTurnstileSiteKey(
  siteKey: string | undefined,
  production: boolean,
) {
  if (production && TEST_SITE_KEYS.includes(siteKey?.trim() ?? '')) {
    throw new Error(
      'Turnstile test site keys are forbidden in production builds',
    )
  }
}

export const turnstileErrorMessages = {
  expired: 'Security verification expired. Please verify again.',
  'challenge-failed': 'Security verification failed. Please try again.',
  'script-failed':
    'Security verification could not load. Reload the page to try again.',
}
