import { memo, useCallback } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import type { AnimeResponse } from '@/api/generated/akariAPI.schemas'
import { remToPx } from '@/lib/layout'
import { AnimePoster, POSTER_HEIGHT_REM } from './anime-poster'

// Folga em volta dos pôsteres dentro do overflow: cobre o contorno e o scale
// do pôster focado, que senão seriam cortados.
export const ROW_PADDING_REM = 1.25

/** Altura da linha (pôsteres + folga). */
export const POSTER_ROW_HEIGHT_REM = POSTER_HEIGHT_REM + ROW_PADDING_REM * 2

interface PosterRowProps {
  focusKey: string
  animes: AnimeResponse[]
  autoFocusFirst: boolean
  onFocused: (anime: AnimeResponse) => void
  onSelect?: (anime: AnimeResponse) => void
}

/**
 * Linha horizontal de pôsteres: uma região de navegação própria (seção 6, "um
 * FocusContext por linha"), que guarda o último item focado e rola na
 * horizontal para manter o pôster em foco dentro da linha.
 */
export const PosterRow = memo(function PosterRow({
  focusKey: rowFocusKey,
  animes,
  autoFocusFirst,
  onFocused,
  onSelect,
}: PosterRowProps) {
  // O elemento da região é também a faixa que rola na horizontal.
  const { ref, focusKey } = useFocusable<unknown, HTMLDivElement>({
    focusKey: rowFocusKey,
    saveLastFocusedChild: true,
  })

  const handleFocused = useCallback(
    (anime: AnimeResponse, _index: number, node: HTMLElement) => {
      const track = ref.current
      if (track) {
        const padding = remToPx(ROW_PADDING_REM)
        const left = node.offsetLeft - padding
        const right = node.offsetLeft + node.offsetWidth + padding
        if (left < track.scrollLeft) {
          track.scrollTo({ left, behavior: 'smooth' })
        } else if (right > track.scrollLeft + track.clientWidth) {
          track.scrollTo({ left: right - track.clientWidth, behavior: 'smooth' })
        }
      }
      onFocused(anime)
    },
    [onFocused, ref],
  )

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="relative flex gap-6 overflow-x-auto [scrollbar-width:none]"
        style={{ height: `${POSTER_ROW_HEIGHT_REM}rem`, padding: `${ROW_PADDING_REM}rem` }}
      >
        {animes.map((anime, index) => (
          <AnimePoster
            key={anime.anilistId}
            anime={anime}
            index={index}
            autoFocus={autoFocusFirst && index === 0}
            onFocused={handleFocused}
            onSelect={onSelect}
          />
        ))}
      </div>
    </FocusContext.Provider>
  )
})
