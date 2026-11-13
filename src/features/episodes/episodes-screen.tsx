import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FocusContext,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation'
import type {
  AnimeResponse,
  VideoFileResponse,
} from '@/api/generated/akariAPI.schemas'
import { useGetAnime } from '@/api/generated/anime/anime'
import {
  useListAnimeEpisodes,
  useListAnimeEpisodesInfinite,
} from '@/api/generated/anime-episodes/anime-episodes'
import { pageInfiniteOptions } from '@/api/pagination'
import { useScreenFocusable } from '@/app/screen'
import {
  playbackRoute,
  type PlaybackItem,
  type PlaybackList,
} from '@/lib/navigation'
import { useUserId } from '@/lib/profile'
import { createStore } from '@/lib/store'
import { AnimeHero } from '@/ui/anime-hero'
import {
  PLAY_BUTTON_HEIGHT_REM,
  PlayButton,
  PlayButtonSkeleton,
} from '@/ui/play-button'
import { SkeletonGroup } from '@/ui/skeleton'
import { EpisodeHero } from './episode-hero'
import { episodeNumberLabel, episodeTitle } from './episode-label'
import { EPISODE_ROW_HEIGHT_REM, EpisodeRow } from './episode-row'
import { EpisodeRowSkeleton } from './episode-row-skeleton'
import { ResumeDialog } from './resume-dialog'

const EPISODES_FOCUS_KEY = 'EPISODES'
const PAGE_SIZE = 40
// Carrega a próxima página quando o foco chega a 10 episódios do fim do que já veio.
const PREFETCH_ITEMS = 10
// Abaixo disso o perfil mal começou: toca do início, sem perguntar.
const RESUME_MIN_SECONDS = 10

/**
 * Onde o perfil parou no arquivo, para oferecer continuar dali; `undefined`
 * quando já assistiu ou mal começou.
 */
function resumePosition(file: VideoFileResponse): number | undefined {
  const progress = file.watchProgress
  if (!progress || progress.watched) return undefined
  return progress.positionSeconds >= RESUME_MIN_SECONDS
    ? progress.positionSeconds
    : undefined
}

// Página única com todos os episódios do anime, só para decidir o botão
// principal: a maior série da coleção tem algumas centenas.
const ALL_EPISODES_SIZE = 2000

/** Episódio do botão principal e se o perfil já tinha começado o anime. */
interface NextUp {
  file: VideoFileResponse
  started: boolean
}

/**
 * Qual episódio o botão principal toca, na ordem do backend: sem progresso
 * em nenhum, o primeiro ("Começar a assistir"); senão, o assistido mais
 * recentemente, se ficou pela metade, ou o seguinte, se foi até o fim.
 * Depois do último episódio assistido até o fim, nenhum (sem botão).
 *
 * Exceção ao princípio 1 da especificação (o app não decide regra de
 * negócio): por decisão do produto, a regra fica aqui, em cima da listagem
 * de episódios com o progresso do perfil, sem rota própria no backend.
 */
function nextUpOf(files: VideoFileResponse[]): NextUp | undefined {
  let latest = -1
  let latestAt = -Infinity
  files.forEach((file, index) => {
    const at =
      file.watchProgress && Date.parse(file.watchProgress.lastWatchedAt)
    if (at && at > latestAt) {
      latest = index
      latestAt = at
    }
  })
  if (latest < 0) return files[0] && { file: files[0], started: false }
  const last = files[latest]
  if (last && !last.watchProgress?.watched) return { file: last, started: true }
  const next = files[latest + 1]
  return next && { file: next, started: true }
}

/** Reprodução aguardando a escolha entre continuar e começar do início. */
interface PendingPlayback {
  item: PlaybackItem & { startSeconds: number }
  list: PlaybackList
}

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
 * episódio, e os sem pareamento no fim), com paginação infinita. Com um
 * perfil, cada episódio vem com o progresso dele: o card marca o assistido e
 * onde parou, e abrir um episódio começado pergunta se continua dali.
 *
 * Filme (`format` `MOVIE`) não tem pareamento TMDB: no lugar do hero do
 * episódio e da linha, o hero do anime (metadados do próprio filme) e um botão
 * de play por arquivo — "Assistir" quando é um só, "Parte 1", "Parte 2"… na
 * ordem do backend quando o filme está dividido em vários.
 */
function EpisodesScreen({ anilistId }: EpisodesScreenProps) {
  const { ref, focusKey } = useScreenFocusable({ focusKey: EPISODES_FOCUS_KEY })
  const [heroStore] = useState(() =>
    createStore<VideoFileResponse | undefined>(undefined),
  )

  const enabled = Number.isInteger(anilistId)
  const userId = useUserId()
  const animeQuery = useGetAnime(anilistId, { query: { enabled } })
  const query = useListAnimeEpisodesInfinite(
    anilistId,
    { size: PAGE_SIZE, ...(userId !== undefined && { userId }) },
    { query: { ...pageInfiniteOptions, enabled } },
  )
  const episodes = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  )

  // Botão principal. Sem perfil não há progresso: é sempre o primeiro
  // episódio, que a linha já trouxe. Com perfil, a regra precisa de todos os
  // episódios (a linha pagina), numa chamada só; sair do player a recarrega
  // junto com a linha (`use-playback-session`).
  const allQuery = useListAnimeEpisodes(
    anilistId,
    { page: 0, size: ALL_EPISODES_SIZE, userId },
    { query: { enabled: enabled && userId !== undefined } },
  )
  const nextUp = useMemo(
    () =>
      nextUpOf(userId === undefined ? episodes : (allQuery.data?.data ?? [])),
    [userId, episodes, allQuery.data],
  )
  const nextUpPending =
    query.isPending || (userId !== undefined && allQuery.isPending)

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
      if (
        index >= total - PREFETCH_ITEMS &&
        current.hasNextPage &&
        !current.isFetchingNextPage
      ) {
        void current.fetchNextPage()
      }
    },
    [heroStore],
  )

  const navigate = useNavigate()
  // Arquivo começado pelo perfil: antes de tocar, o modal pergunta se
  // continua de onde parou. O próximo e o anterior do player não perguntam.
  const [pending, setPending] = useState<PendingPlayback>()
  const play = useCallback(
    (item: PlaybackItem, list: PlaybackList) => {
      const { startSeconds } = item
      if (startSeconds === undefined) navigate(...playbackRoute(item, list))
      else setPending({ item: { ...item, startSeconds }, list })
    },
    [navigate],
  )
  const handleResume = useCallback(() => {
    if (!pending) return
    setPending(undefined)
    navigate(...playbackRoute(pending.item, pending.list))
  }, [pending, navigate])
  const handleRestart = useCallback(() => {
    if (!pending) return
    setPending(undefined)
    navigate(
      ...playbackRoute(
        { ...pending.item, startSeconds: undefined },
        pending.list,
      ),
    )
  }, [pending, navigate])
  // O modal fica fora da região da tela: ela continua lembrando o card (ou o
  // botão) que o abriu, e o foco volta para ele.
  const handleCloseResume = useCallback(() => {
    setPending(undefined)
    setFocus(EPISODES_FOCUS_KEY)
  }, [])
  const resumeDialog = pending && (
    <ResumeDialog
      display={pending.item.display}
      positionSeconds={pending.item.startSeconds}
      onResume={handleResume}
      onRestart={handleRestart}
      onClose={handleCloseResume}
    />
  )

  const anime = animeQuery.data
  const backdrop = anime?.banner ?? undefined
  const episodeItem = useCallback(
    (episode: VideoFileResponse): PlaybackItem => ({
      fileId: episode.id,
      display: {
        title: episodeTitle(episode),
        subtitle: [anime?.titles?.main, episodeNumberLabel(episode)]
          .filter(Boolean)
          .join(' · '),
        backdrop,
      },
      startSeconds: resumePosition(episode),
    }),
    [anime, backdrop],
  )
  // Os que vêm antes e depois na lista já carregada, na ordem do backend. Se
  // o episódio escolhido é o último carregado, não há próximo mesmo havendo
  // mais páginas.
  const handleSelectEpisode = useCallback(
    (episode: VideoFileResponse) => {
      const index = episodes.findIndex((item) => item.id === episode.id)
      play(episodeItem(episode), {
        previous: episodes.slice(0, index).map(episodeItem),
        queue: episodes.slice(index + 1).map(episodeItem),
      })
    },
    [episodes, episodeItem, play],
  )
  const handlePlayNextUp = useCallback(() => {
    if (nextUp) handleSelectEpisode(nextUp.file)
  }, [nextUp, handleSelectEpisode])
  // Com o foco no botão, o hero mostra o episódio que ele vai tocar.
  const handleFocusNextUp = useCallback(() => {
    if (nextUp) heroStore.set(nextUp.file)
  }, [nextUp, heroStore])
  const partItem = useCallback(
    (index: number): PlaybackItem => ({
      fileId: episodes[index]?.id ?? 0,
      display: {
        title: anime?.titles?.main ?? episodes[index]?.name ?? '',
        subtitle: episodes.length === 1 ? undefined : `Parte ${index + 1}`,
        backdrop,
      },
      startSeconds: episodes[index] && resumePosition(episodes[index]),
    }),
    [anime, backdrop, episodes],
  )
  const playPart = useCallback(
    (index: number) => {
      const items = episodes.map((_, partIndex) => partItem(partIndex))
      play(partItem(index), {
        previous: items.slice(0, index),
        queue: items.slice(index + 1),
      })
    },
    [episodes, play, partItem],
  )

  // Hero do anime recebe o filme por store, como nas outras telas; o valor
  // não muda depois de carregado.
  const [movieStore] = useState(() =>
    createStore<AnimeResponse | undefined>(undefined),
  )
  const isMovie = animeQuery.data?.format === 'MOVIE'
  useEffect(() => {
    if (isMovie) movieStore.set(animeQuery.data)
  }, [isMovie, animeQuery.data, movieStore])

  if (isMovie) {
    return (
      <>
        <FocusContext.Provider value={focusKey}>
          <section
            ref={ref}
            aria-label={animeQuery.data?.titles?.main ?? 'Filme'}
            className="flex h-[calc(100svh-6.75rem)] flex-col"
          >
            <AnimeHero store={movieStore} expandableSynopsis />
            <div
              className="mt-8 flex shrink-0 items-center"
              style={{ height: `${PLAY_BUTTON_HEIGHT_REM + 2}rem` }}
            >
              {query.isPending && (
                <SkeletonGroup holdFocus label="Carregando o filme">
                  <PlayButtonSkeleton />
                </SkeletonGroup>
              )}
              {query.isSuccess && episodes.length === 0 && (
                <p className="text-muted-foreground text-[1.75rem]">
                  Nenhum arquivo disponível.
                </p>
              )}
              {episodes.length > 0 && (
                <div className="flex gap-4">
                  {episodes.map((file, index) => (
                    <PlayButton
                      key={file.id}
                      label={
                        episodes.length === 1
                          ? 'Assistir'
                          : `Parte ${index + 1}`
                      }
                      autoFocus={index === 0}
                      onPress={() => playPart(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </FocusContext.Provider>
        {resumeDialog}
      </>
    )
  }

  return (
    <>
      <FocusContext.Provider value={focusKey}>
        <section
          ref={ref}
          aria-label={`Episódios de ${animeQuery.data?.titles?.main ?? 'anime'}`}
          className="flex h-[calc(100svh-6.75rem)] flex-col"
        >
          <EpisodeHero
            anime={animeQuery.data}
            store={heroStore}
            animePending={animeQuery.isPending}
            episodePlaceholder={
              !query.isError && !(query.isSuccess && episodes.length === 0)
            }
          />

          {(nextUpPending || nextUp) && (
            <div
              className="mt-6 flex shrink-0 items-center"
              style={{ height: `${PLAY_BUTTON_HEIGHT_REM}rem` }}
            >
              {nextUpPending ? (
                <SkeletonGroup label="Carregando">
                  <PlayButtonSkeleton />
                </SkeletonGroup>
              ) : (
                nextUp && (
                  <PlayButton
                    label={
                      nextUp.started
                        ? `Continuar ${episodeNumberLabel(nextUp.file) ?? episodeTitle(nextUp.file)}`
                        : 'Começar a assistir'
                    }
                    onPress={handlePlayNextUp}
                    onFocus={handleFocusNextUp}
                  />
                )
              )}
            </div>
          )}

          <div
            className="mt-6 shrink-0"
            style={{ height: `${EPISODE_ROW_HEIGHT_REM}rem` }}
          >
            {query.isPending && <EpisodeRowSkeleton />}
            {query.isError && (
              <p className="text-muted-foreground text-[1.75rem]">
                Não foi possível carregar os episódios ({query.error.message})
              </p>
            )}
            {query.isSuccess && episodes.length === 0 && (
              <p className="text-muted-foreground text-[1.75rem]">
                Nenhum episódio disponível.
              </p>
            )}
            {episodes.length > 0 && (
              <EpisodeRow
                episodes={episodes}
                onFocused={handleFocused}
                onSelect={handleSelectEpisode}
              />
            )}
          </div>
        </section>
      </FocusContext.Provider>
      {resumeDialog}
    </>
  )
}
