import { memo, useCallback } from 'react'
import type { FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation'
import type { MediaFolderResponse } from '@/api/generated/akariAPI.schemas'
import { cn } from '@/lib/utils'
import { Focusable } from '@/ui/focusable'

export const FOLDER_POSTER_WIDTH_REM = 12
export const FOLDER_POSTER_HEIGHT_REM = 18
const UNFOCUSED_OPACITY = 0.7
// Mesma máscara do pôster de anime (ui/anime-poster.tsx): a base da capa some
// para transparente, sem degradê por cima.
const COVER_FADE = 'linear-gradient(to top, transparent, black 45%)'

interface FolderPosterProps {
  folder: MediaFolderResponse
  index: number
  autoFocus: boolean
  onFocused: (
    folder: MediaFolderResponse,
    index: number,
    node: HTMLElement,
  ) => void
  /** OK no pôster. Estável, como `onFocused`. */
  onSelect: (folder: MediaFolderResponse) => void
}

/**
 * Pôster 2:3 de uma pasta nos resultados da busca, com a capa e o título do
 * anime vinculado. Pasta sem anime vinculado mostra o nome da pasta sobre o
 * fundo elevado. Memoizado, com callbacks estáveis da tela (seção 7).
 */
export const FolderPoster = memo(function FolderPoster({
  folder,
  index,
  autoFocus,
  onFocused,
  onSelect,
}: FolderPosterProps) {
  const handleFocus = useCallback(
    (layout: FocusableComponentLayout) => onFocused(folder, index, layout.node),
    [folder, index, onFocused],
  )
  const handleEnter = useCallback(() => onSelect(folder), [folder, onSelect])

  const binding = folder.animeBinding
  const title = binding?.title ?? folder.name
  const cover = binding?.thumbnail

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
            width: `${FOLDER_POSTER_WIDTH_REM}rem`,
            height: `${FOLDER_POSTER_HEIGHT_REM}rem`,
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
