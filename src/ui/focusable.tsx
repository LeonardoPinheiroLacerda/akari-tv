import { memo, useEffect, type ReactNode } from 'react'
import { useFocusable, type FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation'

interface FocusableProps {
  children: (focused: boolean) => ReactNode
  onEnterPress?: () => void
  onFocus?: (layout: FocusableComponentLayout) => void
  focusKey?: string
  autoFocus?: boolean
  className?: string
}

/**
 * Memoizado (seção 7 da especificação): sem isso, qualquer re-render do pai
 * (ex.: outro estado da tela mudando) recria a closure de `children` e força
 * este componente a reprocessar, mesmo sem o foco ter mudado — chegou a
 * aparecer como re-render "fantasma" no diagnóstico em dispositivo real.
 */
export const Focusable = memo(function Focusable({
  children,
  onEnterPress,
  onFocus,
  focusKey,
  autoFocus,
  className,
}: FocusableProps) {
  const { ref, focused, focusSelf } = useFocusable({ onEnterPress, onFocus, focusKey })

  // Só define o foco inicial. A sincronização do foco real do DOM a cada
  // troca (`.focus()` nativo) fica a cargo da lib (`shouldFocusDOMNode` em
  // app/providers.tsx), não daqui — ver o comentário lá.
  useEffect(() => {
    if (autoFocus) {
      focusSelf()
    }
  }, [autoFocus, focusSelf])

  return (
    <div ref={ref} tabIndex={-1} className={className}>
      {children(focused)}
    </div>
  )
})
