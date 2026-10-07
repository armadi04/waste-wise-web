import { Button, cn } from '@heroui/react'
import { Maximize, Minimize } from 'lucide-react'
import type { ButtonProps } from '@heroui/react'
import { useFullscreen } from '@/hooks/global'

interface FullscreenToggleProps extends ButtonProps {}

export const FullscreenToggle = ({
  className,
  ...props
}: FullscreenToggleProps) => {
  const { isFullscreen, toggleFullscreen } = useFullscreen()

  return (
    <Button
      onPress={() => void toggleFullscreen()}
      isIconOnly
      className={cn('cursor-pointer', className)}
      variant="light"
      {...props}
    >
      {isFullscreen ? (
        <Minimize
          size={22}
          className="transition-colors duration-300 text-default-500 hover:text-default-900"
        />
      ) : (
        <Maximize
          size={22}
          className="transition-colors duration-300 text-default-500 hover:text-default-900"
        />
      )}
      <span className="sr-only">Toggle fullscreen</span>
    </Button>
  )
}
