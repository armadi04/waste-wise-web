import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

/** Pixels the pointer must travel before a drag counts as a marquee. */
const DRAG_THRESHOLD = 4
/** Distance from an edge at which the scroll container starts auto-scrolling. */
const AUTOSCROLL_EDGE = 48
const AUTOSCROLL_SPEED = 14

export interface MarqueeRect {
  left: number
  top: number
  width: number
  height: number
}

interface UseMarqueeSelectionOptions {
  /** Replace the selection with these ids. Called on every move of a drag. */
  onSelect: (ids: Array<number>) => void
  /**
   * Selection before the drag started. Snapshotted on mousedown and unioned
   * with the hits when the drag begins with ctrl/cmd held, so a marquee can
   * extend an existing selection instead of replacing it.
   */
  getSelection: () => Array<number>
  disabled?: boolean
}

interface UseMarqueeSelectionResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Container-relative rect to render, or null when no drag is in progress. */
  rect: MarqueeRect | null
  isDragging: boolean
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void
  /**
   * True for the click that immediately follows a marquee drag; resets on the
   * next mousedown.
   *
   * `mouseup` at the end of a drag also fires a `click`, which would otherwise
   * reach the item under the cursor (opening it) and then the container (which
   * clears the selection) — undoing the drag. Every click handler in the
   * selection surface checks this first. Deliberately non-consuming, so the
   * order in which those handlers run doesn't matter.
   */
  wasDragging: () => boolean
}

/** Nearest ancestor that actually scrolls, for auto-scroll during a drag. */
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null
  while (current) {
    const { overflowY } = getComputedStyle(current)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current
    }
    current = current.parentElement
  }
  return null
}

/**
 * Google-Drive-style rubber-band selection.
 *
 * Items opt in by carrying a `data-item-id` attribute; the hook hit-tests their
 * bounding boxes against the dragged rectangle on every move. Drags that start
 * on a button, a link, or an input are ignored so normal clicks still work.
 */
export function useMarqueeSelection({
  onSelect,
  getSelection,
  disabled = false,
}: UseMarqueeSelectionOptions): UseMarqueeSelectionResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [rect, setRect] = useState<MarqueeRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Latest callbacks in refs so the window listeners are installed once and
  // never torn down mid-drag by a re-render.
  const onSelectRef = useRef(onSelect)
  const getSelectionRef = useRef(getSelection)
  onSelectRef.current = onSelect
  getSelectionRef.current = getSelection

  // Also a ref, not state: these change on every mousemove.
  const drag = useRef<{
    startX: number
    startY: number
    base: Array<number>
    started: boolean
  } | null>(null)
  const suppressNextClick = useRef(false)
  const wasDragging = useCallback(() => suppressNextClick.current, [])

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0) return
      if (!containerRef.current) return

      // Interactive controls keep their own gestures. Cards and rows are fair
      // game — Drive lets you rubber-band starting on top of an item, and the
      // drag threshold below keeps plain clicks working.
      const target = event.target as HTMLElement
      // NB: not `[role="button"]` — cards carry that for keyboard access, and
      // excluding it would make most of the grid undraggable.
      if (
        target.closest(
          'button, a, input, label, [role="dialog"], [role="menu"]',
        )
      ) {
        return
      }

      const additive = event.metaKey || event.ctrlKey
      drag.current = {
        startX: event.clientX,
        startY: event.clientY,
        base: additive ? getSelectionRef.current() : [],
        started: false,
      }
    },
    [disabled],
  )

  useEffect(() => {
    // Deliberately NOT gated on `containerRef.current`: on first paint the grid
    // is still a skeleton, so the container does not exist yet. Bailing here
    // with an empty dep array would mean the listeners are never installed and
    // the marquee silently does nothing. The container and its scroll parent
    // are resolved lazily, per gesture, instead.
    const hitTest = (
      container: HTMLElement,
      viewportRect: MarqueeRect,
    ): Array<number> => {
      const ids: Array<number> = []
      container
        .querySelectorAll<HTMLElement>('[data-item-id]')
        .forEach((element) => {
          const box = element.getBoundingClientRect()
          const intersects =
            box.left < viewportRect.left + viewportRect.width &&
            box.left + box.width > viewportRect.left &&
            box.top < viewportRect.top + viewportRect.height &&
            box.top + box.height > viewportRect.top
          if (!intersects) return
          const id = Number(element.dataset.itemId)
          if (Number.isFinite(id)) ids.push(id)
        })
      return ids
    }

    const onMouseMove = (event: MouseEvent) => {
      const state = drag.current
      const container = containerRef.current
      if (!state || !container) return

      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      if (!state.started) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
          return
        }
        state.started = true
        setIsDragging(true)
        // Without this the browser starts a text selection mid-drag.
        document.body.style.userSelect = 'none'
      }

      // Auto-scroll when the pointer nears an edge, so a marquee can reach
      // items below the fold.
      const scrollParent = findScrollParent(container)
      if (scrollParent) {
        const bounds = scrollParent.getBoundingClientRect()
        if (event.clientY > bounds.bottom - AUTOSCROLL_EDGE) {
          scrollParent.scrollTop += AUTOSCROLL_SPEED
        } else if (event.clientY < bounds.top + AUTOSCROLL_EDGE) {
          scrollParent.scrollTop -= AUTOSCROLL_SPEED
        }
      }

      const viewportRect: MarqueeRect = {
        left: Math.min(state.startX, event.clientX),
        top: Math.min(state.startY, event.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      }

      const containerBox = container.getBoundingClientRect()
      setRect({
        left: viewportRect.left - containerBox.left,
        top: viewportRect.top - containerBox.top,
        width: viewportRect.width,
        height: viewportRect.height,
      })
      onSelectRef.current([...state.base, ...hitTest(container, viewportRect)])
    }

    const end = () => {
      const state = drag.current
      drag.current = null
      if (!state?.started) return
      suppressNextClick.current = true
      document.body.style.userSelect = ''
      setIsDragging(false)
      setRect(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') end()
    }

    // Clear the suppression here rather than in the container's own mousedown:
    // that handler returns early for clicks on buttons, so the flag would stay
    // stuck on and swallow every subsequent card click.
    const clearSuppression = () => {
      suppressNextClick.current = false
    }

    window.addEventListener('mousedown', clearSuppression, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', end)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', clearSuppression, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', end)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.userSelect = ''
    }
    // Installed once: the callbacks are read through refs so a re-render can
    // never tear the listeners down mid-drag.
  }, [])

  return { containerRef, rect, isDragging, onMouseDown, wasDragging }
}
