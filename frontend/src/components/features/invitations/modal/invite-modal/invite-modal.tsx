import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ScrollShadow,
} from '@heroui/react'
import { Check, Copy, Mail, Search, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { InviteModalProps } from '@/components/features/invitations/modal/invite-modal/types'
import { Button, Checkbox, Input, Modal } from '@/components/shared/controls'
import { addToast } from '@/components/shared/controls/toast'
import { inviteSchema } from '@/lib/schemas/invitations'

export function InviteModal({
  isOpen,
  onOpenChange,
  allRoles,
  isLoading = false,
  inviteUrl,
  onGenerate,
  onReset,
}: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setEmailError(null)
      setSearch('')
      setSelectedRoles(new Set())
      setCopied(false)
      onReset()
    }
  }, [isOpen])

  const filteredRoles = useMemo(() => {
    return allRoles.filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()),
    )
  }, [allRoles, search])

  const toggleRole = (id: number) => {
    const next = new Set(selectedRoles)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedRoles(next)
  }

  const handleGenerate = () => {
    const parsed = inviteSchema.safeParse({
      email,
      roleIds: Array.from(selectedRoles),
    })
    if (!parsed.success) {
      setEmailError(
        parsed.error.issues[0]?.message ?? 'Please enter a valid email.',
      )
      return
    }
    setEmailError(null)
    onGenerate({ email, roleIds: Array.from(selectedRoles) })
  }

  const handleCopy = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    addToast({ title: 'Link copied to clipboard', color: 'success' })
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex gap-2 items-center">
              <UserPlus size={20} className="text-[var(--app-link)]" />
              <span>{inviteUrl ? 'Invitation Sent' : 'Invite User'}</span>
            </ModalHeader>

            <ModalBody className="pb-2">
              {inviteUrl ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-default-500">
                    An invitation email has been sent. You can also share this
                    link directly — it expires in 7 days.
                  </p>
                  <Input
                    label="Invite link"
                    labelPlacement="outside"
                    value={inviteUrl}
                    isReadOnly
                    variant="bordered"
                    endContent={
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 text-default-400 hover:text-[var(--app-link)]"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <Input
                    label="Email"
                    placeholder="Enter the invitee's email"
                    labelPlacement="outside"
                    value={email}
                    onValueChange={(v) => {
                      setEmail(v)
                      if (emailError) setEmailError(null)
                    }}
                    startContent={
                      <Mail size={16} className="text-default-400" />
                    }
                    variant="bordered"
                    isInvalid={!!emailError}
                    errorMessage={emailError}
                    isRequired
                  />

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-default-700">
                      Roles
                    </span>
                    <Input
                      aria-label="Search roles..."
                      placeholder="Search roles..."
                      startContent={
                        <Search size={16} className="text-default-400" />
                      }
                      value={search}
                      onValueChange={setSearch}
                      variant="flat"
                      size="sm"
                    />
                    <ScrollShadow className="h-[280px] w-full p-2 border-small rounded-medium border-default-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredRoles.map((role) => (
                          <div
                            key={role.id}
                            className={`flex items-start gap-2 p-3 rounded-large border-2 cursor-pointer transition-colors ${
                              selectedRoles.has(role.id)
                                ? 'app-selected border border-[var(--app-selected-border)]'
                                : 'border-transparent bg-default-100 hover:bg-default-200'
                            }`}
                            onClick={() => toggleRole(role.id)}
                          >
                            <Checkbox
                              isSelected={selectedRoles.has(role.id)}
                              onValueChange={() => toggleRole(role.id)}
                              classNames={{ wrapper: 'mt-1' }}
                              color="secondary"
                            />
                            <div className="flex flex-col gap-1">
                              <span className="text-small font-semibold leading-none">
                                {role.name}
                              </span>
                              {role.description && (
                                <span className="text-tiny text-default-500">
                                  {role.description}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollShadow>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={onClose} className="font-medium">
                {inviteUrl ? 'Done' : 'Cancel'}
              </Button>
              {!inviteUrl && (
                <Button
                  color="primary"
                  onPress={handleGenerate}
                  isLoading={isLoading}
                  className="px-8 font-medium"
                >
                  Send Invite
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
