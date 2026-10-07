// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCameraQr } from '@/hooks/portal/use-camera-qr'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('scanner camera lifecycle', () => {
  it('stops a camera stream that resolves after the scanner unmounts', async () => {
    let resolveStream!: (stream: MediaStream) => void
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve
        }),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const { unmount } = renderHook(() => useCameraQr(true, vi.fn()))
    expect(getUserMedia).toHaveBeenCalledOnce()
    unmount()
    await act(async () => {
      resolveStream(stream)
      await Promise.resolve()
    })
    expect(stop).toHaveBeenCalledOnce()
  })

  it('does not request camera access while camera mode is inactive', () => {
    const getUserMedia = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    renderHook(() => useCameraQr(false, vi.fn()))
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
