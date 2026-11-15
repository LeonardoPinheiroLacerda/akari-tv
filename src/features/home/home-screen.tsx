import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { keepPreviousData } from '@tanstack/react-query'
import { useScreenFocusable } from '@/app/screen'
import type {
  AnimeBindingSummary,
  AnimeBindingSummaryPage,
  TorrentDownloadPage,
  TorrentDownloadResponse,
} from '@/api/generated/akariAPI.schemas'
import { useGetAnime } from '@/api/generated/anime/anime'
import { useListTorrentDownloadsInfinite } from '@/api/generated/torrent-download/torrent-download'
import {
  useListSmartListItemsInfinite,
  useListSmartLists,
} from '@/api/generated/smart-list/smart-list'
import { useListUserWatchlistInfinite } from '@/api/generated/user/user'
import { pageInfiniteOptions } from '@/api/pagination'
import { createStore, useStore, type Store } from '@/lib/store'
import { SETTLE_MS, useSettled } from '@/lib/settled'
import { smoothScrollTo } from '@/lib/scroll'
import { focusMemory, PUSHED_SCREEN } from '@/lib/navigation'
import { useUserId } from '@/lib/profile'
import { AnimeHeroView } from '@/ui/anime-hero'
import { POSTER_ROW_HEIGHT_REM, PosterRowSkeleton, ROW_PADDING_REM } from '@/ui/poster-row'
import { HOME_LIST_PAGE_SIZE, HomeListRow, type HomeList, type HomeListItem } from './home-list-row'
import { NEWS_CARD_WIDTH_REM } from './news-card'

export const HOME_FOCUS_KEY = 'HOME'

/** Linha da Início; nas listas inteligentes, com o id do backend para buscar os itens. */
interface HomeListEntry extends HomeList {
  smartListId?: number
}

const NEWS: HomeListEntry = { key: 'news', name: 'Novidades' }
const WATCHLIST: HomeListEntry = { key: 'watchlist', name: 'Minha lista' }

type HomeRowProps = Omit<Parameters<typeof HomeListRow>[0], 'query' | 'items'>

/** Pôsteres das páginas de resumos de anime (as listas): um por anime. */
function summaryItems(pages: AnimeBindingSummaryPage[] | undefined): HomeListItem[] {
  return pages?.flatMap((page) => page.data.map((anime) => ({ key: anime.anilistId, anime }))) ?? []
}

/**
 * Barra do card de uma Novidade: o download enquanto chega; depois, como no card de episódio, até
 * onde o perfil assistiu (o assistido ganha o selo, sem barra).
 */
function newsBar(download: TorrentDownloadResponse): { fraction: number; label: string } | undefined {
  if (download.status === 'DOWNLOADING') {
    return { fraction: download.progress, label: `Baixando ${Math.round(download.progress * 100)}%` }
  }
  const progress = download.watchProgress
  if (!progress || progress.watched || !progress.durationSeconds) return undefined
  const fraction = Math.min(1, progress.positionSeconds / progress.durationSeconds)
  return { fraction, label: `Assistido ${Math.round(fraction * 100)}%` }
}

/** Card de uma Novidade: o episódio, com o progresso do download ou o do perfil. */
function newsItem(download: TorrentDownloadResponse): HomeListItem {
  const episode = download.episode != null ? `E${download.episode}` : 'Pacote'
  const detail =
    download.status === 'DOWNLOADING' ? `Baixando ${Math.round(download.progress * 100)}%` : download.episodeTitle
  return {
    key: `download-${download.id}`,
    anime: download.anime,
    news: {
      thumbnail: download.thumbnail,
      title: download.anime.title ?? '',
      subtitle: detail ? `${episode} · ${detail}` : episode,
      bar: newsBar(download),
      watched: download.watchProgress?.watched === true,
    },
  }
}

const hasDownloading = (pages: TorrentDownloadPage[] | undefined) =>
  pages?.some((page) => page.data.some((download) => download.status === 'DOWNLOADING')) ?? false

/**
 * Novidades: os episódios baixados por torrent, do mais recente para o mais antigo, como o backend
 * entrega — um card por episódio, com o progresso do perfil (fora do modo anônimo). Enquanto algum
 * ainda chega, recarrega para o progresso andar.
 */
const NewsRow = memo(function NewsRow(props: HomeRowProps) {
  const userId = useUserId()
  const query = useListTorrentDownloadsInfinite(
    { size: HOME_LIST_PAGE_SIZE, userId },
    {
      query: {
        ...pageInfiniteOptions,
        refetchInterval: (current) => (hasDownloading(current.state.data?.pages) ? 10_000 : false),
      },
    },
  )
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.data.map(newsItem)) ?? [], [query.data])
  return <HomeListRow {...props} query={query} items={items} itemWidthRem={NEWS_CARD_WIDTH_REM} />
})

/** Linha de uma lista inteligente: os itens recalculados pelo filtro dela. */
const SmartListRow = memo(function SmartListRow({
  smartListId,
  ...props
}: HomeRowProps & { smartListId: number }) {
  const query = useListSmartListItemsInfinite(
    smartListId,
    { size: HOME_LIST_PAGE_SIZE },
    { query: pageInfiniteOptions },
  )
  const items = useMemo(() => summaryItems(query.data?.pages), [query.data])
  return <HomeListRow {...props} query={query} items={items} />
})

/** Linha da lista do perfil, do título adicionado mais recentemente pro mais antigo. */
const WatchlistRow = memo(function WatchlistRow({
  userId,
  ...props
}: HomeRowProps & { userId: number }) {
  const query = useListUserWatchlistInfinite(
    userId,
    { size: HOME_LIST_PAGE_SIZE },
    { query: pageInfiniteOptions },
  )
  const items = useMemo(() => summaryItems(query.data?.pages), [query.data])
  return <HomeListRow {...props} query={query} items={items} />
})

interface HomeHeroProps {
  /** `anilistId` do pôster em foco. */
  store: Store<number | undefined>
  placeholder: boolean
}

/**
 * Hero da Início. Os itens das listas são resumos (`AnimeBindingSummary`),
 * então o hero busca o anime inteiro de onde o foco assentou; enquanto o
 * próximo chega, continua mostrando o anterior.
 */
const HomeHero = memo(function HomeHero({ store, placeholder }: HomeHeroProps) {
  const anilistId = useSettled(useStore(store), SETTLE_MS)
  const query = useGetAnime(anilistId ?? 0, {
    query: { enabled: anilistId !== undefined, placeholderData: keepPreviousData },
  })
  return <AnimeHeroView anime={query.data} placeholder={placeholder} />
})

const HEADING_HEIGHT_REM = 3

/**
 * Nome da lista em foco, fixo acima dos carrosséis: só os pôsteres rolam. A
 * barra na cor da marca e o peso separam o nome da sinopse logo acima; troca
 * de lista com um fade curto.
 */
const ListHeading = memo(function ListHeading({ store }: { store: Store<HomeList | undefined> }) {
  const list = useStore(store)
  return (
    <div
      className="relative mt-8 flex shrink-0 items-center"
      style={{ height: `${HEADING_HEIGHT_REM}rem`, paddingInline: `${ROW_PADDING_REM}rem` }}
    >
      {list && (
        <h2
          key={list.key}
          className="animate-in fade-in flex min-w-0 items-center gap-3 duration-200"
        >
          <span aria-hidden className="bg-brand h-[1.75rem] w-[0.3rem] shrink-0 rounded-full" />
          <span className="truncate text-[2rem] leading-normal font-medium">{list.name}</span>
        </h2>
      )}
    </div>
  )
})

/**
 * Início: hero fixo ocupando a maior parte da tela com o anime em foco e,
 * embaixo, a única região rolável — as Novidades (episódios baixados por
 * torrent), a lista do perfil (fora do modo anônimo) e as listas
 * inteligentes, na ordem do backend, um carrossel de pôsteres por
 * linha, com o nome da lista em foco fixo acima. A área mostra exatamente uma
 * lista; ▲/▼ trocam de lista e a rolagem segue o foco (seção 6).
 */
export function HomeScreen() {
  const { ref, focusKey } = useScreenFocusable({ focusKey: HOME_FOCUS_KEY })
  const [heroStore] = useState(() => createStore<number | undefined>(undefined))
  const [listStore] = useState(() => createStore<HomeList | undefined>(undefined))
  const scrollRef = useRef<HTMLDivElement>(null)
  const userId = useUserId()

  const query = useListSmartLists()
  // As linhas aparecem juntas, quando as listas inteligentes chegam: o foco
  // inicial é decidido uma vez, já com todas.
  const lists = useMemo(() => {
    if (!query.data) return undefined
    const smartLists = query.data.map((list): HomeListEntry => ({
      key: `smart-${list.id}`,
      name: list.name,
      smartListId: list.id,
    }))
    // Novidades primeiro (o que acabou de chegar), depois a lista do perfil e as inteligentes.
    return userId === undefined ? [NEWS, ...smartLists] : [NEWS, WATCHLIST, ...smartLists]
  }, [query.data, userId])

  // Lista do foco inicial, decidida uma vez quando as listas chegam: a de onde
  // o usuário saiu (ao voltar do detalhe), se ainda existir, ou a primeira.
  // Se ela vier vazia ou com erro, passa para a seguinte; `null` quando
  // nenhuma tem o que focar.
  const [restoreListKey] = useState(() => focusMemory.get(HOME_FOCUS_KEY))
  const [focusListKey, setFocusListKey] = useState<string | null>()
  if (focusListKey === undefined && lists) {
    const restored = lists.find((list) => list.key === restoreListKey)
    setFocusListKey((restored ?? lists[0])?.key ?? null)
  }

  const latestLists = useRef(lists)
  useLayoutEffect(() => {
    latestLists.current = lists
  })
  const handleUnavailable = useCallback((listKey: string) => {
    const all = latestLists.current ?? []
    const index = all.findIndex((list) => list.key === listKey)
    setFocusListKey((current) => (current === listKey ? (all[index + 1]?.key ?? null) : current))
  }, [])

  const handleFocused = useCallback(
    (list: HomeList, anime: AnimeBindingSummary, row: HTMLElement) => {
      heroStore.set(anime.anilistId)
      listStore.set(list)
      focusMemory.set(HOME_FOCUS_KEY, list.key)
      const container = scrollRef.current
      if (container) smoothScrollTo(container, { top: row.offsetTop })
    },
    [heroStore, listStore],
  )

  const navigate = useNavigate()
  const handleSelect = useCallback(
    (anime: AnimeBindingSummary) => navigate(`/anime/${anime.anilistId}`, { state: PUSHED_SCREEN }),
    [navigate],
  )

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} aria-label="Início" className="flex h-[calc(100svh-6.75rem)] flex-col">
        {/* Sem anime para mostrar (erro, nenhuma lista com itens), o hero não fica pulsando. */}
        <HomeHero store={heroStore} placeholder={!query.isError && focusListKey !== null} />

        <ListHeading store={listStore} />
        <div
          ref={scrollRef}
          className="relative shrink-0 [scrollbar-width:none] overflow-y-auto"
          style={{ height: `${POSTER_ROW_HEIGHT_REM}rem` }}
        >
          {query.isPending && <PosterRowSkeleton />}
          {query.isError && (
            <p className="text-muted-foreground text-[1.75rem]">
              Não foi possível carregar as listas ({query.error.message})
            </p>
          )}
          {lists?.length === 0 && (
            <p className="text-muted-foreground text-[1.75rem]">Nenhuma lista cadastrada</p>
          )}
          {lists?.map((list) =>
            list.key === NEWS.key ? (
              <NewsRow
                key={list.key}
                list={list}
                autoFocus={list.key === focusListKey}
                onFocused={handleFocused}
                onSelect={handleSelect}
                onUnavailable={handleUnavailable}
              />
            ) : list.smartListId !== undefined ? (
              <SmartListRow
                key={list.key}
                smartListId={list.smartListId}
                list={list}
                autoFocus={list.key === focusListKey}
                onFocused={handleFocused}
                onSelect={handleSelect}
                onUnavailable={handleUnavailable}
              />
            ) : (
              userId !== undefined && (
                <WatchlistRow
                  key={list.key}
                  userId={userId}
                  list={list}
                  autoFocus={list.key === focusListKey}
                  onFocused={handleFocused}
                  onSelect={handleSelect}
                  onUnavailable={handleUnavailable}
                />
              )
            ),
          )}
        </div>
      </section>
    </FocusContext.Provider>
  )
}
