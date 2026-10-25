import { useEffect, type ReactNode } from 'react'
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation'

interface FocusableProps {
  children: (focused: boolean) => ReactNode
  onEnterPress?: () => void
  focusKey?: string
  autoFocus?: boolean
  className?: string
}

export function Focusable({
  children,
  onEnterPress,
  focusKey,
  autoFocus,
  className,
}: FocusableProps) {
  const { ref, focused, focusSelf } = useFocusable({ onEnterPress, focusKey })

  useEffect(() => {
    if (autoFocus) {
      focusSelf()
    }
  }, [autoFocus, focusSelf])

  useEffect(() => {
    if (focused) {
      ref.current?.focus({ preventScroll: true })
    }
  }, [focused, ref])

  return (
    <div ref={ref} tabIndex={-1} className={className}>
      {children(focused)}
    </div>
  )
}
