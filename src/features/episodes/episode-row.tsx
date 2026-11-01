import { memo, useCallback } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VideoFileResponse } from '@/api/generated/akariAPI.schemas'
import { remToPx } from '@/lib/layout'
import { ROW_PADDING_REM } from '@/ui/poster-row'
import { CARD_HEIGHT_REM, CARD_WIDTH_REM, EpisodeCard } from './episode-card'

export const EPISODE_GAP_REM = 1.5
// Cards montados além dos visíveis, de cada lado: o próximo card já existe
// quando a seta chega nele, e o total fica abaixo dos 20 da seção 7.
const OVERSCAN = 6

export const EPISODE_ROW_HEIGHT_REM = CARD_HEIGHT_REM + ROW_PADDING_REM * 2

interface EpisodeRowProps {
  episodes: VideoFileResponse[]
  onFocused: (episode: VideoFileResponse, index: number) => void
  onSelect?: (episode: VideoFileResponse) => void
}

/**
 * Linha horizontal de episódios, virtualizada: uma série pode ter centenas de
 * episódios (BLEACH tem 366), mas só os visíveis mais a folga ficam no DOM.
 * A rolagem segue o foco com `scrollToIndex`, mantendo a folga do contorno.
 */
export const EpisodeRow = memo(function EpisodeRow({
  episodes,
  onFocused,
  onSelect,
}: EpisodeRowProps) {
  const { ref, focusKey } = useFocusable<unknown, HTMLDivElement>({
    focusKey: 'EPISODES_ROW',
    saveLastFocusedChild: true,
  })

  const padding = remToPx(ROW_PADDING_REM)
  const virtualizer = useVirtualizer({
    count: episodes.length,
    horizontal: true,
    getScrollElement: () => ref.current,
    estimateSize: () => remToPx(CARD_WIDTH_REM),
    gap: remToPx(EPISODE_GAP_REM),
    overscan: OVERSCAN,
    paddingStart: padding,
    paddingEnd: padding,
    scrollPaddingStart: padding,
    scrollPaddingEnd: padding,
  })

  const handleFocused = useCallback(
    (episode: VideoFileResponse, index: number) => {
      virtualizer.scrollToIndex(index, { align: 'auto', behavior: 'smooth' })
      onFocused(episode, index)
    },
    [virtualizer, onFocused],
  )

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="[scrollbar-width:none] overflow-x-auto"
        style={{ height: `${EPISODE_ROW_HEIGHT_REM}rem` }}
      >
        <div
          className="relative h-full"
          style={{ width: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const episode = episodes[item.index]
            if (!episode) return null
            return (
              // Posição por `left`, não `transform`: a navegação espacial mede
              // pelo `offsetLeft`, que ignora transform — com translateX todos
              // os cards pareceriam estar na mesma posição e a seta não andaria.
              // É posição estática, não animação (seção 7 continua valendo).
              <div
                key={episode.id}
                className="absolute"
                style={{ top: padding, left: item.start }}
              >
                <EpisodeCard
                  episode={episode}
                  index={item.index}
                  autoFocus={item.index === 0}
                  onFocused={handleFocused}
                  onSelect={onSelect}
                />
              </div>
            )
          })}
        </div>
      </div>
    </FocusContext.Provider>
  )
})
