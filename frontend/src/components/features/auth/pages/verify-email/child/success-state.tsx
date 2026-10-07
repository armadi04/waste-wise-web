import { Button } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { CheckCircle } from 'lucide-react'

export function SuccessState({ message }: { message: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Email Verified!
        </h1>
        <p className="text-sm text-default-500 leading-relaxed">
          {message || 'Your email has been verified successfully.'}
        </p>
      </div>
      <Button
        as={Link}
        to="/"
        className="w-full h-11 bg-primary hover:bg-primary-700 text-primary-foreground font-medium"
      >
        Go to Dashboard
      </Button>
    </div>
  )
}
