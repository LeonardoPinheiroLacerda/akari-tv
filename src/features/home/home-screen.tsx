import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import type { AnimeResponse } from '@/api/generated/akariAPI.schemas'
import { useListRelationRootsInfinite } from '@/api/generated/anime-relations/anime-relations'
import { pageInfiniteOptions } from '@/api/pagination'
import { createStore } from '@/lib/store'
import { AnimePoster, POSTER_HEIGHT_REM } from './anime-poster'
import { HomeHero } from './home-hero'

export const HOME_FOCUS_KEY = 'HOME'

const PAGE_SIZE = 40
const COLUMNS = 8
// Carrega a próxima página quando o foco chega a 2 linhas do fim do que já veio.
const PREFETCH_ROWS = 2
// Folga entre o topo da área rolável e a linha em foco; cobre o contorno e o
// scale do pôster focado, que senão seriam cortados pelo overflow.
const GRID_PADDING_REM = 1.25

function remToPx(rem: number): number {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}

/**
 * Início (esboço): hero fixo ocupando a maior parte da tela com o anime em
 * foco e, embaixo, a única região rolável — a coleção (animes-raiz) em grade,
 * com paginação infinita. A área mostra exatamente uma linha; a rolagem segue
 * o foco, trazendo a linha focada para dentro dela (seção 6).
 */
export function HomeScreen() {
  const { ref, focusKey } = useFocusable({
    focusKey: HOME_FOCUS_KEY,
    saveLastFocusedChild: true,
  })
  const [heroStore] = useState(() => createStore<AnimeResponse | undefined>(undefined))
  const scrollRef = useRef<HTMLDivElement>(null)

  const query = useListRelationRootsInfinite(
    { size: PAGE_SIZE },
    { query: pageInfiniteOptions },
  )
  const animes = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data])

  // Último estado da query num ref: o callback de foco fica estável e os
  // pôsteres memoizados não re-renderizam quando uma página nova chega.
  const latest = useRef({ query, total: animes.length })
  useLayoutEffect(() => {
    latest.current = { query, total: animes.length }
  })

  const handleFocused = useCallback(
    (anime: AnimeResponse, index: number, node: HTMLElement) => {
      heroStore.set(anime)

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

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} aria-label="Início" className="flex h-[calc(100svh-6.75rem)] flex-col">
        <HomeHero store={heroStore} />

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
                autoFocus={index === 0}
                onFocused={handleFocused}
              />
            ))}
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  )
}
