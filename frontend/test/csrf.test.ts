// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getCsrfToken } from '@/lib/utils/csrf'

describe('CSRF cookie contract', () => {
  it('reads the backend cookie name and preserves equals characters', () => {
    document.cookie = 'csrf_token=wrong; Path=/'
    document.cookie = 'csrfToken=valid=value; Path=/'
    expect(getCsrfToken()).toBe('valid=value')
  })
})
