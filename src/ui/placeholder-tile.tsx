import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Focusable } from './focusable'

interface PlaceholderTileProps {
  label: string
  autoFocus?: boolean
  className?: string
}

/**
 * Bloco focável provisório para as telas placeholder (Início, Buscar), até
 * os componentes reais (Carousel, Grid, campo de busca) existirem. Foco numa
 * camada própria: só transform e outline-color animam, 120ms (seção 3/7).
 */
export const PlaceholderTile = memo(function PlaceholderTile({
  label,
  autoFocus,
  className,
}: PlaceholderTileProps) {
  return (
    <Focusable autoFocus={autoFocus}>
      {(focused) => (
        <div
          className={cn(
            'bg-surface-elevated text-muted-foreground flex items-center justify-center rounded-xl text-[1.75rem]',
            className,
          )}
          style={{
            transform: focused ? 'scale(1.05)' : 'scale(1)',
            outlineStyle: 'solid',
            // 4dp de design (seção 3) em rem: número puro aqui seria px de CSS,
            // o dobro na densidade 2 da TV. Laranja da marca, como a sidebar.
            outlineWidth: '0.25rem',
            outlineOffset: '0.125rem',
            outlineColor: focused ? 'var(--color-brand)' : 'transparent',
            transition: 'transform 120ms, outline-color 120ms',
          }}
        >
          {label}
        </div>
      )}
    </Focusable>
  )
})
