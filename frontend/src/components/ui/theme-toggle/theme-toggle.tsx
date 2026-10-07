import { Button, cn } from '@heroui/react'
import { Moon, Sun } from 'lucide-react'
import { useRef } from 'react'
import type { ButtonProps } from '@heroui/react'
import { useTheme } from '@/hooks/global'

interface ThemeToggleProps extends ButtonProps {
  duration?: number
}

export const ThemeToggle = ({
  className,
  duration = 400,
  ...props
}: ThemeToggleProps) => {
  const { isDark, toggleTheme } = useTheme(duration)
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <Button
      ref={buttonRef}
      onPress={() => void toggleTheme(buttonRef.current)}
      isIconOnly
      radius="full"
      color="primary"
      variant="light"
      className={cn('relative z-99999! cursor-pointer', className)}
      {...props}
    >
      {isDark ? (
        <Sun className="transition-colors duration-300 hover:text-warning" />
      ) : (
        <Moon className="transition-colors duration-300 hover:text-default-400" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
