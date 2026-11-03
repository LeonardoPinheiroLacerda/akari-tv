import { memo, useCallback } from 'react'
import type { FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation'
import type { FranchiseSummary } from '@/api/generated/akariAPI.schemas'
import { cn } from '@/lib/utils'
import { Focusable } from '@/ui/focusable'
import { Skeleton } from '@/ui/skeleton'

export const FRANCHISE_POSTER_WIDTH_REM = 12
export const FRANCHISE_POSTER_HEIGHT_REM = 18
const UNFOCUSED_OPACITY = 0.7
// Mesma máscara do pôster de anime (ui/anime-poster.tsx): a base da capa some
// para transparente, sem degradê por cima.
const COVER_FADE = 'linear-gradient(to top, transparent, black 45%)'

interface FranchisePosterProps {
  franchise: FranchiseSummary
  index: number
  autoFocus: boolean
  onFocused: (
    franchise: FranchiseSummary,
    index: number,
    node: HTMLElement,
  ) => void
  /** OK no pôster. Estável, como `onFocused`. */
  onSelect: (franchise: FranchiseSummary) => void
}

/**
 * Pôster 2:3 de uma franquia nos resultados da busca, com a capa e o título
 * da raiz. Raiz sem capa mostra o título sobre o fundo elevado. Memoizado,
 * com callbacks estáveis da tela (seção 7).
 */
export const FranchisePoster = memo(function FranchisePoster({
  franchise,
  index,
  autoFocus,
  onFocused,
  onSelect,
}: FranchisePosterProps) {
  const handleFocus = useCallback(
    (layout: FocusableComponentLayout) =>
      onFocused(franchise, index, layout.node),
    [franchise, index, onFocused],
  )
  const handleEnter = useCallback(
    () => onSelect(franchise),
    [franchise, onSelect],
  )

  const { title, thumbnail: cover } = franchise.root

  return (
    <Focusable
      autoFocus={autoFocus}
      onFocus={handleFocus}
      onEnterPress={handleEnter}
    >
      {(focused) => (
        <div
          className={cn(
            'relative overflow-hidden rounded-xl',
            !cover && 'bg-surface-elevated',
          )}
          style={{
            width: `${FRANCHISE_POSTER_WIDTH_REM}rem`,
            height: `${FRANCHISE_POSTER_HEIGHT_REM}rem`,
            contain: 'layout paint',
            transform: focused ? 'scale(1.05)' : 'scale(1)',
            opacity: focused ? 1 : UNFOCUSED_OPACITY,
            outlineStyle: 'solid',
            outlineWidth: '0.25rem',
            outlineOffset: '0.125rem',
            outlineColor: focused ? 'var(--color-brand)' : 'transparent',
            transition: 'transform 120ms, opacity 120ms, outline-color 120ms',
          }}
        >
          {cover ? (
            <>
              <img
                src={cover}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
                style={{ maskImage: COVER_FADE }}
              />
              <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                <p className="line-clamp-2 text-center text-[1.5rem] leading-tight font-medium">
                  {title}
                </p>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-[1.75rem] break-words">
              {title}
            </div>
          )}
        </div>
      )}
    </Focusable>
  )
})

/** Pôster no tamanho real enquanto a busca carrega (dentro de um `SkeletonGroup`). */
export function FranchisePosterSkeleton() {
  return (
    <Skeleton
      style={{
        width: `${FRANCHISE_POSTER_WIDTH_REM}rem`,
        height: `${FRANCHISE_POSTER_HEIGHT_REM}rem`,
      }}
    />
  )
}
