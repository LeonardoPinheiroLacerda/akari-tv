import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import type { AnimeResponse, VideoFileResponse } from '@/api/generated/akariAPI.schemas'
import { useGetAnime } from '@/api/generated/anime/anime'
import { useListAnimeEpisodesInfinite } from '@/api/generated/anime-episodes/anime-episodes'
import { pageInfiniteOptions } from '@/api/pagination'
import { useScreenFocusable } from '@/app/screen'
import { createStore } from '@/lib/store'
import { AnimeHero } from '@/ui/anime-hero'
import { PLAY_BUTTON_HEIGHT_REM, PlayButton } from '@/ui/play-button'
import { EpisodeHero } from './episode-hero'
import { EPISODE_ROW_HEIGHT_REM, EpisodeRow } from './episode-row'

const EPISODES_FOCUS_KEY = 'EPISODES'
const PAGE_SIZE = 40
// Carrega a próxima página quando o foco chega a 10 episódios do fim do que já veio.
const PREFETCH_ITEMS = 10

/** Rota `/anime/:anilistId/episodes`: uma instância por anime. */
export function EpisodesRoute() {
  const { anilistId } = useParams()
  return <EpisodesScreen key={anilistId} anilistId={Number(anilistId)} />
}

interface EpisodesScreenProps {
  anilistId: number
}

/**
 * Episódios de um anime: hero fixo com o anime e o episódio em foco e, embaixo,
 * os episódios numa linha, na ordem do backend (`GET .../episodes`: temporada,
 * episódio, e os sem pareamento no fim), com paginação infinita.
 *
 * Filme (`format` `MOVIE`) não tem pareamento TMDB: no lugar do hero do
 * episódio e da linha, o hero do anime (metadados do próprio filme) e um botão
 * de play por arquivo — "Assistir" quando é um só, "Parte 1", "Parte 2"… na
 * ordem do backend quando o filme está dividido em vários.
 */
function EpisodesScreen({ anilistId }: EpisodesScreenProps) {
  const { ref, focusKey } = useScreenFocusable({ focusKey: EPISODES_FOCUS_KEY })
  const [heroStore] = useState(() => createStore<VideoFileResponse | undefined>(undefined))

  const enabled = Number.isInteger(anilistId)
  const animeQuery = useGetAnime(anilistId, { query: { enabled } })
  const query = useListAnimeEpisodesInfinite(
    anilistId,
    { size: PAGE_SIZE },
    { query: { ...pageInfiniteOptions, enabled } },
  )
  const episodes = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data])

  // Último estado da query num ref: o callback de foco fica estável e os cards
  // memoizados não re-renderizam quando uma página nova chega.
  const latest = useRef({ query, total: episodes.length })
  useLayoutEffect(() => {
    latest.current = { query, total: episodes.length }
  })

  const handleFocused = useCallback(
    (episode: VideoFileResponse, index: number) => {
      heroStore.set(episode)
      const { query: current, total } = latest.current
      if (index >= total - PREFETCH_ITEMS && current.hasNextPage && !current.isFetchingNextPage) {
        void current.fetchNextPage()
      }
    },
    [heroStore],
  )

  // Hero do anime recebe o filme por store, como nas outras telas; o valor
  // não muda depois de carregado.
  const [movieStore] = useState(() => createStore<AnimeResponse | undefined>(undefined))
  const isMovie = animeQuery.data?.format === 'MOVIE'
  useEffect(() => {
    if (isMovie) movieStore.set(animeQuery.data)
  }, [isMovie, animeQuery.data, movieStore])

  if (isMovie) {
    return (
      <FocusContext.Provider value={focusKey}>
        <section
          ref={ref}
          aria-label={animeQuery.data?.titles?.main ?? 'Filme'}
          className="flex h-[calc(100svh-6.75rem)] flex-col"
        >
          <AnimeHero store={movieStore} />
          <div
            className="mt-8 flex shrink-0 items-center"
            style={{ height: `${PLAY_BUTTON_HEIGHT_REM + 2}rem` }}
          >
            {query.isPending && (
              <p className="text-[1.75rem] text-muted-foreground">Carregando…</p>
            )}
            {query.isSuccess && episodes.length === 0 && (
              <p className="text-[1.75rem] text-muted-foreground">Nenhum arquivo disponível.</p>
            )}
            {/* O player ainda não existe: o OK fica sem ação até ele entrar. */}
            {episodes.length > 0 && (
              <div className="flex gap-4">
                {episodes.map((file, index) => (
                  <PlayButton
                    key={file.id}
                    label={episodes.length === 1 ? 'Assistir' : `Parte ${index + 1}`}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </FocusContext.Provider>
    )
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <section
        ref={ref}
        aria-label={`Episódios de ${animeQuery.data?.titles?.main ?? 'anime'}`}
        className="flex h-[calc(100svh-6.75rem)] flex-col"
      >
        <EpisodeHero anime={animeQuery.data} store={heroStore} />

        <div className="mt-6 shrink-0" style={{ height: `${EPISODE_ROW_HEIGHT_REM}rem` }}>
          {query.isPending && <p className="text-[1.75rem] text-muted-foreground">Carregando…</p>}
          {query.isError && (
            <p className="text-[1.75rem] text-muted-foreground">
              Não foi possível carregar os episódios ({query.error.message})
            </p>
          )}
          {query.isSuccess && episodes.length === 0 && (
            <p className="text-[1.75rem] text-muted-foreground">Nenhum episódio disponível.</p>
          )}
          {episodes.length > 0 && <EpisodeRow episodes={episodes} onFocused={handleFocused} />}
        </div>
      </section>
    </FocusContext.Provider>
  )
}
