import {
  Kbd,
  Modal,
  ModalBody,
  ModalContent,
  ScrollShadow,
} from '@heroui/react'
import { Search } from 'lucide-react'
import { CommandRow } from '@/components/layout/command-palette/child/command-row'
import { useCommandPalette, useCommandPaletteShortcut } from '@/hooks/global'

/**
 * ⌘K command palette — searches every nav destination the user can reach plus
 * the account/appearance actions. Mounted once by the layout so the shortcut
 * works on screens that render no header.
 */
export const CommandPalette = () => {
  useCommandPaletteShortcut()

  const {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    results,
    sections,
    activeIndex,
    setActiveIndex,
    runCommand,
    onInputKeyDown,
  } = useCommandPalette()

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="top"
      hideCloseButton
      scrollBehavior="inside"
      classNames={{
        base: 'mt-[10vh] max-w-xl',
        body: 'p-0',
      }}
    >
      <ModalContent>
        <div className="flex items-center gap-3 border-b border-divider px-4 py-3">
          <Search size={18} className="shrink-0 text-default-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages and actions…"
            aria-label="Search pages and actions"
            className="w-full bg-transparent text-sm outline-none placeholder:text-default-400"
          />
          <Kbd className="shrink-0 text-xs" keys={['escape']}>
            Esc
          </Kbd>
        </div>

        <ModalBody>
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-default-400">
              No results for “{query}”
            </p>
          ) : (
            <ScrollShadow className="max-h-[60vh] p-2">
              {sections.map((section) => (
                <div key={section.title} className="mb-1">
                  <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-default-400">
                    {section.title}
                  </p>
                  {section.commands.map((command) => (
                    <CommandRow
                      key={command.key}
                      command={command}
                      isActive={results[activeIndex]?.key === command.key}
                      onHover={() =>
                        setActiveIndex(
                          results.findIndex((r) => r.key === command.key),
                        )
                      }
                      onRun={() => runCommand(command)}
                    />
                  ))}
                </div>
              ))}
            </ScrollShadow>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
