import { AnimatePresence, motion } from 'framer-motion'
import {
  BRAND_LOGO_SRC,
  BRAND_NAME,
  BRAND_NAME_LEADING,
  BRAND_NAME_TRAILING,
} from '@/lib/constants/brand'

interface SidebarBrandProps {
  isCollapsed: boolean
}

export function SidebarBrand({ isCollapsed }: SidebarBrandProps) {
  return (
    <AnimatePresence mode="wait">
      {isCollapsed ? (
        <motion.div
          key="collapsed-logo"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="whitespace-nowrap"
        >
          <img
            src={BRAND_LOGO_SRC}
            alt={BRAND_NAME}
            width={32}
            height={32}
            draggable={false}
            decoding="async"
            className="h-8 w-8 object-contain"
          />
        </motion.div>
      ) : (
        <motion.div
          key="expanded-logo"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2.5"
        >
          <img
            src={BRAND_LOGO_SRC}
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            draggable={false}
            decoding="async"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div className="font-semibold text-2xl tracking-tight italic">
            <span className="text-[var(--app-link)]">{BRAND_NAME_LEADING}</span>
            <span className="text-foreground">{BRAND_NAME_TRAILING}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
