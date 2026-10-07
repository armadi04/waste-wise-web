import { Suspense, lazy } from 'react'
import type { ComponentType } from 'react'

interface PlayerProps {
  loop?: boolean
  className?: string
}

// `lottie-web` is ~250 kB and the animation JSON adds ~190 kB more — none of it
// belongs in the entry chunk. Player + data are fetched together, on demand.
// `LottieSvg` is the smaller build: svg renderer only, expressions kept.
function lazyAnimation(
  load: () => Promise<{ default: unknown }>,
): ComponentType<PlayerProps> {
  return lazy(async () => {
    const [{ LottieSvg }, animation] = await Promise.all([
      import('lottie-react'),
      load(),
    ])
    return {
      default: ({ loop, className }: PlayerProps) => (
        <LottieSvg
          src={animation.default as object}
          loop={loop}
          className={className}
          autoplay
        />
      ),
    }
  })
}

const NotFoundPlayer = lazyAnimation(() => import('@/assets/lottie/404.json'))
const EmptyPlayer = lazyAnimation(() => import('@/assets/lottie/empty.json'))

const players = { notFound: NotFoundPlayer, empty: EmptyPlayer }

interface LottieAnimationProps extends PlayerProps {
  name: keyof typeof players
}

export function LottieAnimation({
  name,
  loop = true,
  className,
}: LottieAnimationProps) {
  const Player = players[name]
  // Decorative only — an empty box while it loads is fine.
  return (
    <Suspense fallback={<div className={className} />}>
      <Player loop={loop} className={className} />
    </Suspense>
  )
}
