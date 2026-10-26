import { memo, useCallback } from 'react'
import type { FocusableComponentLayout } from '@noriginmedia/norigin-spatial-navigation'
import type { VideoFileResponse } from '@/api/generated/akariAPI.schemas'
import { cn } from '@/lib/utils'
import { Focusable } from '@/ui/focusable'
import { episodeNumberLabel, episodeTitle } from './episode-label'

// 16:9 com 288px de largura na TV (densidade 2): a menor imagem que o TMDB
// entrega (`w300`) fica acima do tamanho exibido, como pede a seção 7.
export const CARD_WIDTH_REM = 18
export const CARD_HEIGHT_REM = 10.125
// Mesma linguagem dos pôsteres: fora de foco esmaecido, base da imagem some
// por máscara para o texto ficar legível sem uma camada escura por cima.
const UNFOCUSED_OPACITY = 0.55
const COVER_FADE = 'linear-gradient(to top, transparent, black 60%)'

interface EpisodeCardProps {
  episode: VideoFileResponse
  index: number
  autoFocus: boolean
  onFocused: (episode: VideoFileResponse, index: number, node: HTMLElement) => void
}

/** Card do episódio: thumbnail do TMDB com número e título na base. */
export const EpisodeCard = memo(function EpisodeCard({
  episode,
  index,
  autoFocus,
  onFocused,
}: EpisodeCardProps) {
  const handleFocus = useCallback(
    (layout: FocusableComponentLayout) => onFocused(episode, index, layout.node),
    [episode, index, onFocused],
  )
  const thumbnail = episode.tmdbPairing?.thumbnailPreviewUrl
  const number = episodeNumberLabel(episode)
  const title = episodeTitle(episode)

  return (
    <Focusable autoFocus={autoFocus} onFocus={handleFocus}>
      {(focused) => (
        <div
          className={cn('relative overflow-hidden rounded-xl', !thumbnail && 'bg-surface-elevated')}
          style={{
            width: `${CARD_WIDTH_REM}rem`,
            height: `${CARD_HEIGHT_REM}rem`,
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
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
              style={{ maskImage: COVER_FADE }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2">
            {number && <p className="text-[1.75rem] leading-tight font-medium">{number}</p>}
            <p className="truncate text-[1.75rem] leading-tight text-muted-foreground">{title}</p>
          </div>
        </div>
      )}
    </Focusable>
  )
})
