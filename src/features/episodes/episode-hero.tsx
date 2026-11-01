import { memo } from 'react'
import { CalendarDays, Clock, Star } from 'lucide-react'
import type {
  AnimeResponse,
  VideoFileResponse,
} from '@/api/generated/akariAPI.schemas'
import { dateLabel, scoreLabel } from '@/lib/format'
import { useStore, type Store } from '@/lib/store'
import { AnimeTitle, Backdrop } from '@/ui/anime-hero'
import { ExpandableSynopsis } from '@/ui/expandable-synopsis'
import { InfoBadge } from '@/ui/info-badge'
import { episodeNumberLabel, episodeTitle } from './episode-label'

interface EpisodeHeroProps {
  anime?: AnimeResponse
  store: Store<VideoFileResponse | undefined>
}

/**
 * Hero fixo da tela de episódios: o fundo e o logo são do anime e não mudam
 * ao navegar (nenhuma imagem grande decodificada a cada foco, seção 7); só o
 * texto acompanha o episódio em foco, recebido por `store`.
 */
export const EpisodeHero = memo(function EpisodeHero({
  anime,
  store,
}: EpisodeHeroProps) {
  const episode = useStore(store)
  const pairing = episode?.tmdbPairing
  const number = episode && episodeNumberLabel(episode)

  return (
    <>
      <Backdrop
        src={anime?.banner ?? anime?.thumbnails?.small ?? undefined}
        blurred={!anime?.banner}
      />
      <div className="relative flex min-h-0 flex-1 flex-col items-start justify-end gap-4">
        <AnimeTitle anime={anime} />
        {episode && (
          <h2 className="max-w-[56rem] text-[2.25rem] leading-tight font-medium">
            {number && <span className="text-brand">{number} · </span>}
            {episodeTitle(episode)}
          </h2>
        )}
        {pairing && (
          <div className="flex flex-wrap gap-3">
            {pairing.episodeAirDate && (
              <InfoBadge
                icon={CalendarDays}
                label={dateLabel(pairing.episodeAirDate)}
              />
            )}
            {pairing.episodeRuntime != null && (
              <InfoBadge icon={Clock} label={`${pairing.episodeRuntime} min`} />
            )}
            {pairing.episodeVoteAverage != null && (
              <InfoBadge
                icon={Star}
                label={scoreLabel(pairing.episodeVoteAverage)}
                iconColor="var(--color-brand)"
                filled
              />
            )}
          </div>
        )}
        {episode && pairing?.episodeOverview && (
          <ExpandableSynopsis
            text={pairing.episodeOverview}
            title={[number, episodeTitle(episode)].filter(Boolean).join(' · ')}
          />
        )}
      </div>
    </>
  )
})
