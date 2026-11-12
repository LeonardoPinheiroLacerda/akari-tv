import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { keepPreviousData } from '@tanstack/react-query'
import { useScreenFocusable } from '@/app/screen'
import type { AnimeBindingSummary, SmartListResponse } from '@/api/generated/akariAPI.schemas'
import { useGetAnime } from '@/api/generated/anime/anime'
import { useListSmartLists } from '@/api/generated/smart-list/smart-list'
import { createStore, useStore, type Store } from '@/lib/store'
import { SETTLE_MS, useSettled } from '@/lib/settled'
import { smoothScrollTo } from '@/lib/scroll'
import { focusMemory, PUSHED_SCREEN } from '@/lib/navigation'
import { AnimeHeroView } from '@/ui/anime-hero'
import { POSTER_ROW_HEIGHT_REM, PosterRowSkeleton, ROW_PADDING_REM } from '@/ui/poster-row'
import { SmartListRow } from './smart-list-row'

export const HOME_FOCUS_KEY = 'HOME'

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
const ListHeading = memo(function ListHeading({
  store,
}: {
  store: Store<SmartListResponse | undefined>
}) {
  const list = useStore(store)
  return (
    <div
      className="relative mt-8 flex shrink-0 items-center"
      style={{ height: `${HEADING_HEIGHT_REM}rem`, paddingInline: `${ROW_PADDING_REM}rem` }}
    >
      {list && (
        <h2
          key={list.id}
          className="flex min-w-0 animate-in items-center gap-3 fade-in duration-200"
        >
          <span aria-hidden className="h-[1.75rem] w-[0.3rem] shrink-0 rounded-full bg-brand" />
          <span className="truncate text-[2rem] leading-normal font-medium">{list.name}</span>
        </h2>
      )}
    </div>
  )
})

/**
 * Início: hero fixo ocupando a maior parte da tela com o anime em foco e,
 * embaixo, a única região rolável — as listas inteligentes, na ordem do
 * backend, um carrossel de pôsteres por linha, com o nome da lista em foco
 * fixo acima. A área mostra exatamente uma lista; ▲/▼ trocam de lista e a
 * rolagem segue o foco (seção 6).
 */
export function HomeScreen() {
  const { ref, focusKey } = useScreenFocusable({ focusKey: HOME_FOCUS_KEY })
  const [heroStore] = useState(() => createStore<number | undefined>(undefined))
  const [listStore] = useState(() => createStore<SmartListResponse | undefined>(undefined))
  const scrollRef = useRef<HTMLDivElement>(null)

  const query = useListSmartLists()
  const lists = query.data

  // Lista do foco inicial, decidida uma vez quando as listas chegam: a de onde
  // o usuário saiu (ao voltar do detalhe), se ainda existir, ou a primeira.
  // Se ela vier vazia ou com erro, passa para a seguinte; `null` quando
  // nenhuma tem o que focar.
  const [restoreListId] = useState(() => focusMemory.get(HOME_FOCUS_KEY))
  const [focusListId, setFocusListId] = useState<number | null>()
  if (focusListId === undefined && lists) {
    const restored = lists.find((list) => list.id === restoreListId)
    setFocusListId((restored ?? lists[0])?.id ?? null)
  }

  const latestLists = useRef(lists)
  useLayoutEffect(() => {
    latestLists.current = lists
  })
  const handleUnavailable = useCallback((listId: number) => {
    const all = latestLists.current ?? []
    const index = all.findIndex((list) => list.id === listId)
    setFocusListId((current) => (current === listId ? (all[index + 1]?.id ?? null) : current))
  }, [])

  const handleFocused = useCallback(
    (list: SmartListResponse, anime: AnimeBindingSummary, row: HTMLElement) => {
      heroStore.set(anime.anilistId)
      listStore.set(list)
      focusMemory.set(HOME_FOCUS_KEY, list.id)
      const container = scrollRef.current
      if (container) smoothScrollTo(container, { top: row.offsetTop })
    },
    [heroStore, listStore],
  )

  const navigate = useNavigate()
  const handleSelect = useCallback(
    (anime: AnimeBindingSummary) =>
      navigate(`/anime/${anime.anilistId}`, { state: PUSHED_SCREEN }),
    [navigate],
  )

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} aria-label="Início" className="flex h-[calc(100svh-6.75rem)] flex-col">
        {/* Sem anime para mostrar (erro, nenhuma lista com itens), o hero não fica pulsando. */}
        <HomeHero store={heroStore} placeholder={!query.isError && focusListId !== null} />

        <ListHeading store={listStore} />
        <div
          ref={scrollRef}
          className="relative shrink-0 overflow-y-auto [scrollbar-width:none]"
          style={{ height: `${POSTER_ROW_HEIGHT_REM}rem` }}
        >
          {query.isPending && <PosterRowSkeleton />}
          {query.isError && (
            <p className="text-[1.75rem] text-muted-foreground">
              Não foi possível carregar as listas ({query.error.message})
            </p>
          )}
          {lists?.length === 0 && (
            <p className="text-[1.75rem] text-muted-foreground">Nenhuma lista cadastrada</p>
          )}
          {lists?.map((list) => (
            <SmartListRow
              key={list.id}
              list={list}
              autoFocus={list.id === focusListId}
              onFocused={handleFocused}
              onSelect={handleSelect}
              onUnavailable={handleUnavailable}
            />
          ))}
        </div>
      </section>
    </FocusContext.Provider>
  )
}
