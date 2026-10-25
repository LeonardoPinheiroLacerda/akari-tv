import { memo, useCallback } from 'react'
import type { FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation'
import type { AnimeResponse } from '@/api/generated/akariAPI.schemas'
import { Focusable } from '@/ui/focusable'

export const POSTER_WIDTH_REM = 12
export const POSTER_HEIGHT_REM = 18

interface AnimePosterProps {
  anime: AnimeResponse
  index: number
  autoFocus: boolean
  onFocused: (anime: AnimeResponse, index: number, node: HTMLElement) => void
}

/**
 * Pôster 2:3 da grade. Memoizado e com `onFocused` estável vindo da tela, para
 * a troca de foco re-renderizar só os dois pôsteres envolvidos (seção 7).
 */
export const AnimePoster = memo(function AnimePoster({
  anime,
  index,
  autoFocus,
  onFocused,
}: AnimePosterProps) {
  const handleFocus = useCallback(
    (layout: FocusableComponentLayout) => onFocused(anime, index, layout.node),
    [anime, index, onFocused],
  )
  const title = anime.titles?.main ?? ''
  // `medium` (230×320) é a menor capa acima do tamanho exibido (192×288 px no
  // canvas, 202×302 com o scale do foco), como pede a seção 7. A `large`
  // (460×640) seria reduzida 2,4× e a WebView reduz com filtragem bilinear
  // simples acima de ~2×, o que serrilha a imagem — além de pesar 3× mais.
  const cover = anime.thumbnails?.medium ?? anime.thumbnails?.large

  return (
    <Focusable autoFocus={autoFocus} onFocus={handleFocus}>
      {(focused) => (
        <div
          className="overflow-hidden rounded-xl bg-surface-elevated"
          style={{
            width: `${POSTER_WIDTH_REM}rem`,
            height: `${POSTER_HEIGHT_REM}rem`,
            contain: 'layout paint',
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
          {cover ? (
            <img
              src={cover}
              alt={title}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center p-4 text-center text-[1.75rem] text-muted-foreground">
              {title}
            </div>
          )}
        </div>
      )}
    </Focusable>
  )
})
