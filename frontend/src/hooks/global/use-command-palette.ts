import { useNavigate } from '@tanstack/react-router'
import {
  LogOut,
  Maximize,
  Minimize,
  Moon,
  PanelLeft,
  Sun,
  User,
} from 'lucide-react'
import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import type { NavItem } from '@/lib/constants/sidebar'
import { useFullscreen } from '@/hooks/global/use-fullscreen'
import { useSidebarLogic } from '@/hooks/global/use-sidebar'
import { useTheme } from '@/hooks/global/use-theme'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useCommandPaletteStore } from '@/lib/stores/command-palette.store'
import { useSidebarStore } from '@/lib/stores/sidebar.store'

export interface Command {
  key: string
  label: string
  /** Section header the command is listed under. */
  group: string
  icon: React.ReactNode
  /** Extra terms the search should match on beyond the label. */
  keywords?: string
  /** Right-aligned hint (a route, a current value). */
  hint?: string
  isDanger?: boolean
  /** Whether running it should leave the palette open (in-place toggles). */
  keepOpen?: boolean
  run: () => void
}

/**
 * Registers the global ⌘K / Ctrl+K shortcut. Mounted once (by the palette) so
 * the binding exists even on screens that render no header.
 */
export const useCommandPaletteShortcut = () => {
  const toggle = useCommandPaletteStore((s) => s.toggle)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])
}

/**
 * Builds the command list for the palette: every navigable sidebar entry the
 * user may actually see (permissions already applied by `useSidebarLogic`)
 * plus the account/appearance actions, filtered by the current query.
 */
export const useCommandPalette = () => {
  const isOpen = useCommandPaletteStore((s) => s.isOpen)
  const setIsOpen = useCommandPaletteStore((s) => s.setIsOpen)
  const close = useCommandPaletteStore((s) => s.close)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const navigate = useNavigate()
  const { filteredSidebarData } = useSidebarLogic()
  const { isDark, toggleTheme } = useTheme()
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const toggleSidebar = useSidebarStore((s) => s.toggleSidebar)
  const isCollapsed = useSidebarStore((s) => s.isCollapsed)
  const logout = useAuthStore((s) => s.logout)

  const commands = useMemo<Array<Command>>(() => {
    const navCommands: Array<Command> = []

    const collect = (item: NavItem, group: string, trail: Array<string>) => {
      if (item.href) {
        navCommands.push({
          key: `nav:${item.key}`,
          label: item.label,
          group,
          icon: item.icon,
          keywords: [...trail, item.href].join(' '),
          hint: item.href,
          run: () =>
            item.href?.startsWith('http')
              ? window.open(item.href, '_blank', 'noopener,noreferrer')
              : navigate({ to: item.href!, viewTransition: true }),
        })
      }
      item.children?.forEach((child) =>
        collect(child, group, [...trail, item.label]),
      )
    }

    filteredSidebarData.forEach((group) =>
      group.items.forEach((item) => collect(item, group.title, [group.title])),
    )

    const actionCommands: Array<Command> = [
      {
        key: 'action:profile',
        label: 'Profile',
        group: 'Account',
        icon: createElement(User, { size: 18 }),
        keywords: 'account me user',
        run: () => navigate({ to: '/profile', viewTransition: true }),
      },
      {
        key: 'action:theme',
        label: isDark ? 'Switch to light mode' : 'Switch to dark mode',
        group: 'Appearance',
        icon: isDark
          ? createElement(Sun, { size: 18 })
          : createElement(Moon, { size: 18 }),
        keywords: 'theme dark light appearance',
        keepOpen: true,
        run: () => void toggleTheme(),
      },
      {
        key: 'action:fullscreen',
        label: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
        group: 'Appearance',
        icon: isFullscreen
          ? createElement(Minimize, { size: 18 })
          : createElement(Maximize, { size: 18 }),
        keywords: 'fullscreen screen',
        keepOpen: true,
        run: () => void toggleFullscreen(),
      },
      {
        key: 'action:sidebar',
        label: isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
        group: 'Appearance',
        icon: createElement(PanelLeft, { size: 18 }),
        keywords: 'sidebar menu collapse expand',
        keepOpen: true,
        run: toggleSidebar,
      },
      {
        key: 'action:logout',
        label: 'Log out',
        group: 'Account',
        icon: createElement(LogOut, { size: 18 }),
        keywords: 'logout signout exit',
        isDanger: true,
        run: () => void logout(),
      },
    ]

    return [...navCommands, ...actionCommands]
  }, [
    filteredSidebarData,
    navigate,
    isDark,
    toggleTheme,
    isFullscreen,
    toggleFullscreen,
    isCollapsed,
    toggleSidebar,
    logout,
  ])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return commands
    return commands.filter((command) =>
      `${command.label} ${command.group} ${command.keywords ?? ''}`
        .toLowerCase()
        .includes(term),
    )
  }, [commands, query])

  /** Results regrouped for rendering, preserving command order. */
  const sections = useMemo(() => {
    const order: Array<string> = []
    const byGroup = new Map<string, Array<Command>>()
    results.forEach((command) => {
      if (!byGroup.has(command.group)) {
        byGroup.set(command.group, [])
        order.push(command.group)
      }
      byGroup.get(command.group)!.push(command)
    })
    return order.map((title) => ({ title, commands: byGroup.get(title)! }))
  }, [results])

  // Reset the query each time the palette opens; keep the cursor in range as
  // results shrink while typing.
  useEffect(() => {
    if (isOpen) setQuery('')
  }, [isOpen])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const runCommand = useCallback(
    (command: Command) => {
      if (!command.keepOpen) close()
      command.run()
    },
    [close],
  )

  /** Arrow/Enter handling for the search input driving the result list. */
  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) =>
          results.length ? (prev + 1) % results.length : 0,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) =>
          results.length ? (prev - 1 + results.length) % results.length : 0,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const command = results[activeIndex]
        if (command) runCommand(command)
      }
    },
    [results, activeIndex, runCommand],
  )

  return {
    isOpen,
    setIsOpen,
    close,
    query,
    setQuery,
    results,
    sections,
    activeIndex,
    setActiveIndex,
    runCommand,
    onInputKeyDown,
  }
}
