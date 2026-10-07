import { Button, Card, CardBody, Input, Tab, Tabs } from '@heroui/react'
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ScanLine,
  XCircle,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import type { ScanOutcome } from '@/components/features/portal/components/pass-scanner/types'
import type { PassKind } from '@/lib/utils/pass-token'
import { passTokenKind } from '@/lib/utils/pass-token'

import { useCameraQr } from '@/hooks/portal'

export function PassScanner({
  canRedeem,
  canCheckIn,
  busy,
  outcome,
  onScan,
}: {
  canRedeem: boolean
  canCheckIn: boolean
  busy: boolean
  outcome: ScanOutcome | null
  onScan: (kind: PassKind, token: string) => void
}) {
  const [mode, setMode] = useState<'manual' | 'camera'>('manual')
  const [cameraOn, setCameraOn] = useState(false)
  const [token, setToken] = useState('')
  const fallback: PassKind = canRedeem ? 'voucher' : 'ticket'
  const allowed = (kind: PassKind) =>
    kind === 'voucher' ? canRedeem : canCheckIn
  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      onScan(passTokenKind(trimmed, fallback), trimmed)
      setToken('')
    },
    [fallback, onScan],
  )
  const handleDecode = useCallback(
    (text: string) => {
      setCameraOn(false)
      submit(text)
    },
    [submit],
  )
  const { videoRef, error } = useCameraQr(
    mode === 'camera' && cameraOn && !busy,
    handleDecode,
  )
  const pendingKind = token.trim() ? passTokenKind(token, fallback) : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card className="border border-default-100">
        <CardBody className="gap-4">
          <Tabs
            aria-label="Scan input"
            selectedKey={mode}
            onSelectionChange={(key) => {
              setMode(key as 'manual' | 'camera')
              setCameraOn(false)
            }}
          >
            <Tab key="manual" title="Scanner / paste" />
            <Tab key="camera" title="Camera" />
          </Tabs>
          {mode === 'manual' ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                submit(token)
              }}
            >
              <Input
                autoFocus
                label="Pass QR code"
                placeholder="KM1.…"
                value={token}
                onValueChange={setToken}
                isDisabled={busy}
                description="USB scanners type the code and press Enter. Customer QR codes expire after about a minute."
              />
              {pendingKind && !allowed(pendingKind) && (
                <p className="text-sm text-danger">
                  You do not have permission to verify {pendingKind}s.
                </p>
              )}
              <Button
                type="submit"
                color="primary"
                startContent={<ScanLine size={18} />}
                isLoading={busy}
                isDisabled={
                  !token.trim() ||
                  (pendingKind !== null && !allowed(pendingKind))
                }
              >
                Verify pass
              </Button>
            </form>
          ) : (
            <div className="grid gap-3">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-default-100">
                {cameraOn ? (
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                    aria-label="Camera preview"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-default-500">
                    Camera is off
                  </div>
                )}
              </div>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button
                color={cameraOn ? 'default' : 'primary'}
                startContent={
                  cameraOn ? <CameraOff size={18} /> : <Camera size={18} />
                }
                isDisabled={busy}
                onPress={() => setCameraOn((on) => !on)}
              >
                {cameraOn ? 'Stop camera' : 'Start camera'}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
      <Card className="border border-default-100">
        <CardBody className="gap-2">
          <h3 className="font-semibold">Last result</h3>
          {outcome ? (
            <div
              role="status"
              className={`flex items-start gap-2 text-sm ${outcome.ok ? 'text-success' : 'text-danger'}`}
            >
              {outcome.ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              <span>{outcome.message}</span>
            </div>
          ) : (
            <p className="text-sm text-default-500">No pass verified yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
