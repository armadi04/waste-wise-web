import { useLocation, useNavigate } from '@tanstack/react-router'
import React, { useCallback, useEffect, useState } from 'react'
import type { NavGroup, NavItem } from '@/lib/constants/sidebar'
import { useProfile } from '@/hooks/auth/use-auth'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  sidebarData,
} from '@/lib/constants/sidebar'
import { useSidebarStore } from '@/lib/stores/sidebar.store'

// Re-export the store-backed sidebar hooks for call-site compatibility.
export {
  useSidebar,
  useSidebarCollapsed,
  useSidebarWidth,
} from '@/lib/stores/sidebar.store'

/**
 * Derives the sidebar's route-aware UI: which items are visible (by permission),
 * the active item, and which parent groups are expanded. Collapse state comes
 * from the Zustand store; active/expanded keys are local because they are
 * derived from the current route.
 */
export const useSidebarLogic = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isCollapsed = useSidebarStore((s) => s.isCollapsed)
  const setIsCollapsed = useSidebarStore((s) => s.setIsCollapsed)
  const { data: profile } = useProfile()
  const { hasPermission: checkPermission } = useUserPermission()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    new Set(['database']),
  )

  // Filter sidebar items based on menu permissions and data permissions
  const filteredSidebarData = React.useMemo(() => {
    const filterItem = (item: NavItem): NavItem | null => {
      // Check menu permission first (controls visibility)
      if (item.menuPermission && !checkPermission(item.menuPermission)) {
        return null
      }

      // Check data-level permission (controls access to resource)
      if (
        item.permission &&
        !(
          Array.isArray(item.permission) ? item.permission : [item.permission]
        ).some(checkPermission)
      ) {
        return null
      }

      // Check children
      if (item.children && item.children.length > 0) {
        const filteredChildren = item.children
          .map(filterItem)
          .filter((child): child is NavItem => child !== null)

        // If all children filtered out and no direct href, hide item
        if (filteredChildren.length === 0 && !item.href) {
          return null
        }

        return { ...item, children: filteredChildren }
      }

      return item
    }

    return sidebarData
      .map((group) => ({
        ...group,
        items: group.items
          .map(filterItem)
          .filter((item): item is NavItem => item !== null),
      }))
      .filter((group) => group.items.length > 0)
  }, [checkPermission])

  // Sync active key with current location
  useEffect(() => {
    const path = location.pathname

    const findActiveItem = (items: Array<NavGroup>): string | null => {
      const matchRef: { current: { key: string; length: number } | null } = {
        current: null,
      }

      const checkItem = (item: NavItem) => {
        if (item.href) {
          const isExact = item.href === path
          const isSubPath =
            item.href !== '/' && path.startsWith(`${item.href}/`)

          if (isExact || isSubPath) {
            if (
              !matchRef.current ||
              item.href.length > matchRef.current.length
            ) {
              matchRef.current = { key: item.key, length: item.href.length }
            }
          }
        }

        if (item.children) {
          item.children.forEach(checkItem)
        }
      }

      items.forEach((group) => group.items.forEach(checkItem))
      return matchRef.current?.key || null
    }

    // Routes with no nav entry of their own (e.g. /profile) must clear the
    // highlight, not leave the previously visited item lit.
    const key = findActiveItem(filteredSidebarData)
    setActiveKey(key)
    if (key) {
      filteredSidebarData.forEach((group) => {
        group.items.forEach((item) => {
          if (item.children?.some((child) => child.key === key)) {
            setExpandedKeys((prev) => new Set(prev).add(item.key))
          }
        })
      })
    }
  }, [location.pathname, filteredSidebarData])

  const handleToggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (key: string, href?: string) => {
      if (href?.startsWith('http')) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return
      }
      setActiveKey(key)
      if (href) {
        navigate({ to: href, viewTransition: true })
      }
    },
    [navigate],
  )

  return {
    isCollapsed,
    setIsCollapsed,
    profile,
    activeKey,
    expandedKeys,
    filteredSidebarData,
    handleToggle,
    handleSelect,
    sidebarWidth: isCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH,
  }
}
