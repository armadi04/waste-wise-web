import React from 'react'
import { BottomNav } from '@/components/layout/bottom-nav'
import { CommandPalette } from '@/components/layout/command-palette'
import { Header } from '@/components/layout/header'
import {
  SIDEBAR_EXPANDED_WIDTH,
  Sidebar,
  useSidebarWidth,
} from '@/components/layout/sidebar'

interface LayoutProps {
  children: React.ReactNode
  withHeader?: boolean
}

export const Layout = ({ children, withHeader = true }: LayoutProps) => {
  const sidebarWidth = useSidebarWidth()

  return (
    <div
      className="min-h-dvh lg:h-screen lg:overflow-hidden"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Sidebar - hidden on mobile, fixed on desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/*
        Main content. On desktop the shell is a fixed-height inset panel that
        does NOT scroll — only its inner content area scrolls. The panel is
        wrapped by the sidebar (left) and its own outline, floating on the
        body backdrop.
      */}
      <main className="min-h-dvh transition-all duration-300 ease-out flex flex-col relative lg:h-screen lg:pb-3 lg:ml-[var(--sidebar-width)] lg:p-3 lg:pl-1">
        {/*
          On mobile the panel runs edge to edge and all the way to the bottom of
          the viewport — it used to stop short of the floating nav, which left a
          strip of the body backdrop below it and read as a broken page end. The
          inset, rounded, floating panel is a desktop-only treatment.
        */}
        <div className="[view-transition-name:main-panel] flex flex-1 min-h-0 flex-col overflow-hidden bg-content1 lg:rounded-large lg:border lg:border-default-200">
          {withHeader && <Header />}
          {/* The floating mobile nav overlays the bottom of the scroll area, so
              the last item keeps clear space above the pill and safe area. */}
          <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-clip p-4 pb-[calc(7rem+env(safe-area-inset-bottom))]! sm:p-6 sm:pb-[calc(7rem+env(safe-area-inset-bottom))]! lg:pb-4!">
            {children}
          </div>
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />

      {/* Global ⌘K palette — one instance owns the shortcut. */}
      <CommandPalette />
    </div>
  )
}

export { SIDEBAR_EXPANDED_WIDTH }
