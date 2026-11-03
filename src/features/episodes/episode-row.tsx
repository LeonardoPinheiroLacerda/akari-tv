import { memo, useCallback, useState } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VideoFileResponse } from '@/api/generated/akariAPI.schemas'
import { remToPx } from '@/lib/layout'
import { scrollTarget, smoothScrollTo } from '@/lib/scroll'
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
 * A rolagem segue o foco mantendo a folga do contorno.
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

  // Foco inicial no primeiro card só na primeira montagem: o virtualizer
  // desmonta e remonta o card ao rolar, e um `autoFocus` que valesse sempre
  // puxaria o foco de volta ao E1 assim que a rolagem chegasse perto dele
  // (segurando ◀, o foco saltava do E7 para o E1).
  const [initialFocusDone, setInitialFocusDone] = useState(false)

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
      // Decide pelo alvo pendente, não pela posição: com a seta segurada a
      // rolagem ainda está a caminho do passo anterior (o `align: 'auto'` do
      // virtualizer olha a posição e recalcularia a partir dela).
      const track = ref.current
      const start = virtualizer.getOffsetForIndex(index, 'start')?.[0]
      const end = virtualizer.getOffsetForIndex(index, 'end')?.[0]
      if (track && start !== undefined && end !== undefined) {
        const current = scrollTarget(track).left
        if (start < current) smoothScrollTo(track, { left: start })
        else if (end > current) smoothScrollTo(track, { left: end })
      }
      setInitialFocusDone(true)
      onFocused(episode, index)
    },
    [virtualizer, onFocused, ref],
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
              // Posição por `left`, não `transform`: é posição estática, não
              // animação (seção 7), e mantém a caixa do card onde ele aparece.
              // Antes era obrigatório — a navegação espacial media pelo
              // `offsetLeft`, que ignora transform —; hoje ela usa
              // `getBoundingClientRect` (app/providers.tsx).
              <div
                key={episode.id}
                className="absolute"
                style={{ top: padding, left: item.start }}
              >
                <EpisodeCard
                  episode={episode}
                  index={item.index}
                  autoFocus={!initialFocusDone && item.index === 0}
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
