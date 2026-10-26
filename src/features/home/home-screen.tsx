import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useScreenFocusable } from '@/app/screen'
import type { AnimeResponse } from '@/api/generated/akariAPI.schemas'
import { useListRelationRootsInfinite } from '@/api/generated/anime-relations/anime-relations'
import { pageInfiniteOptions } from '@/api/pagination'
import { createStore } from '@/lib/store'
import { remToPx } from '@/lib/layout'
import { focusMemory, PUSHED_SCREEN } from '@/lib/navigation'
import { AnimeHero } from '@/ui/anime-hero'
import { AnimePoster, POSTER_HEIGHT_REM } from '@/ui/anime-poster'

export const HOME_FOCUS_KEY = 'HOME'

const PAGE_SIZE = 40
const COLUMNS = 8
// Carrega a próxima página quando o foco chega a 2 linhas do fim do que já veio.
const PREFETCH_ROWS = 2
// Folga entre o topo da área rolável e a linha em foco; cobre o contorno e o
// scale do pôster focado, que senão seriam cortados pelo overflow.
const GRID_PADDING_REM = 1.25

/**
 * Início (esboço): hero fixo ocupando a maior parte da tela com o anime em
 * foco e, embaixo, a única região rolável — a coleção (animes-raiz) em grade,
 * com paginação infinita. A área mostra exatamente uma linha; a rolagem segue
 * o foco, trazendo a linha focada para dentro dela (seção 6).
 */
export function HomeScreen() {
  const { ref, focusKey } = useScreenFocusable({ focusKey: HOME_FOCUS_KEY })
  const [heroStore] = useState(() => createStore<AnimeResponse | undefined>(undefined))
  const scrollRef = useRef<HTMLDivElement>(null)

  const query = useListRelationRootsInfinite(
    { size: PAGE_SIZE },
    { query: pageInfiniteOptions },
  )
  const animes = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data])

  // Foco inicial decidido uma vez, quando a coleção chega: o anime de onde o
  // usuário saiu (ao voltar do detalhe), se ainda estiver na lista, ou o
  // primeiro. Fixo depois disso, para páginas novas não puxarem o foco.
  const [restoreId] = useState(() => focusMemory.get(HOME_FOCUS_KEY))
  const [initialFocusId, setInitialFocusId] = useState<number>()
  const first = animes[0]
  if (initialFocusId === undefined && first) {
    setInitialFocusId(
      animes.some((anime) => anime.anilistId === restoreId) ? restoreId : first.anilistId,
    )
  }

  // Último estado da query num ref: o callback de foco fica estável e os
  // pôsteres memoizados não re-renderizam quando uma página nova chega.
  const latest = useRef({ query, total: animes.length })
  useLayoutEffect(() => {
    latest.current = { query, total: animes.length }
  })

  const handleFocused = useCallback(
    (anime: AnimeResponse, index: number, node: HTMLElement) => {
      heroStore.set(anime)
      focusMemory.set(HOME_FOCUS_KEY, anime.anilistId)

      scrollRef.current?.scrollTo({
        top: Math.max(0, node.offsetTop - remToPx(GRID_PADDING_REM)),
        behavior: 'smooth',
      })

      const { query: current, total } = latest.current
      if (
        index >= total - COLUMNS * PREFETCH_ROWS &&
        current.hasNextPage &&
        !current.isFetchingNextPage
      ) {
        void current.fetchNextPage()
      }
    },
    [heroStore],
  )

  const navigate = useNavigate()
  const handleSelect = useCallback(
    (anime: AnimeResponse) => navigate(`/anime/${anime.anilistId}`, { state: PUSHED_SCREEN }),
    [navigate],
  )

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} aria-label="Início" className="flex h-[calc(100svh-6.75rem)] flex-col">
        <AnimeHero store={heroStore} />

        <div
          ref={scrollRef}
          className="relative mt-6 shrink-0 overflow-y-auto [scrollbar-width:none]"
          style={{
            padding: `${GRID_PADDING_REM}rem`,
            height: `${POSTER_HEIGHT_REM + GRID_PADDING_REM * 2}rem`,
          }}
        >
          {query.isPending && <p className="text-[1.75rem] text-muted-foreground">Carregando…</p>}
          {query.isError && (
            <p className="text-[1.75rem] text-muted-foreground">
              Não foi possível carregar a coleção ({query.error.message})
            </p>
          )}
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${COLUMNS}, max-content)` }}
          >
            {animes.map((anime, index) => (
              <AnimePoster
                key={anime.anilistId}
                anime={anime}
                index={index}
                autoFocus={anime.anilistId === initialFocusId}
                onFocused={handleFocused}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  )
}
