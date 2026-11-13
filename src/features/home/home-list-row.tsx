import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { observeElementRect, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import type { ApiError } from '@/api/errors'
import type {
  AnimeBindingSummary,
  AnimeBindingSummaryPage,
} from '@/api/generated/akariAPI.schemas'
import { remToPx } from '@/lib/layout'
import { focusMemory } from '@/lib/navigation'
import { scrollTarget, smoothScrollTo } from '@/lib/scroll'
import { AnimeSummaryPoster, POSTER_WIDTH_REM } from '@/ui/anime-poster'
import { POSTER_ROW_HEIGHT_REM, PosterRowSkeleton, ROW_PADDING_REM } from '@/ui/poster-row'

export const HOME_LIST_PAGE_SIZE = 20
// Carrega a próxima página quando o foco chega a este número de itens do fim.
const PREFETCH_ITEMS = 8
const POSTER_GAP_REM = 1.5
// Pôsteres montados além dos visíveis, de cada lado: o próximo já existe
// quando a seta chega nele, e o total fica abaixo dos 20 da seção 7.
const OVERSCAN = 5

/** Uma linha da Início: a lista do perfil ou uma lista inteligente. */
export interface HomeList {
  key: string
  name: string
}

/** Itens de uma linha, paginados no envelope de resumos de anime. */
export type HomeListQuery = UseInfiniteQueryResult<InfiniteData<AnimeBindingSummaryPage>, ApiError>

/** Região de foco da lista; também a chave do último pôster focado nela. */
function homeListFocusKey(listKey: string): string {
  return `HOME_LIST_${listKey}`
}

/**
 * Mede a linha ignorando tamanho zero: com outra tela por cima, a Início fica
 * montada com `display: none`, e o virtualizer desmontaria todos os pôsteres
 * (ver `EpisodeRow`).
 */
function observeVisibleRect(
  instance: Virtualizer<HTMLDivElement, Element>,
  callback: (rect: { width: number; height: number }) => void,
) {
  return observeElementRect(instance, (rect) => {
    if (rect.width > 0 && rect.height > 0) callback(rect)
  })
}

interface HomeListRowProps {
  list: HomeList
  query: HomeListQuery
  /** Esta lista recebe o foco inicial da tela (o último pôster focado nela, ou o primeiro). */
  autoFocus: boolean
  onFocused: (list: HomeList, anime: AnimeBindingSummary, row: HTMLElement) => void
  onSelect: (anime: AnimeBindingSummary) => void
  /** A lista do foco inicial veio vazia ou com erro: a tela passa o foco inicial adiante. Estável. */
  onUnavailable: (listKey: string) => void
}

/**
 * Uma lista na Início: os itens num carrossel horizontal,
 * virtualizado e com paginação infinita (o nome fica no cabeçalho fixo da
 * tela). É uma região de foco
 * própria que lembra o último pôster focado; lista vazia não aparece nem
 * recebe foco.
 */
export const HomeListRow = memo(function HomeListRow({
  list,
  query,
  autoFocus,
  onFocused,
  onSelect,
  onUnavailable,
}: HomeListRowProps) {
  const rowFocusKey = homeListFocusKey(list.key)
  const sectionRef = useRef<HTMLElement>(null)
  const animes = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data])
  const unavailable = query.isError || (query.isSuccess && animes.length === 0)

  const { ref, focusKey } = useFocusable<unknown, HTMLDivElement>({
    focusKey: rowFocusKey,
    saveLastFocusedChild: true,
    focusable: animes.length > 0,
  })

  useEffect(() => {
    if (autoFocus && unavailable) onUnavailable(list.key)
  }, [autoFocus, unavailable, onUnavailable, list.key])

  // Foco inicial decidido uma vez, quando os itens chegam: o pôster de onde o
  // usuário saiu, se ainda estiver na lista, ou o primeiro. Só na primeira
  // montagem do pôster: o virtualizer remonta pôsteres ao rolar, e um
  // `autoFocus` que valesse sempre puxaria o foco de volta (ver `EpisodeRow`).
  const [restoreId] = useState(() => focusMemory.get(rowFocusKey))
  const [initialIndex, setInitialIndex] = useState<number>()
  if (initialIndex === undefined && animes.length > 0) {
    setInitialIndex(Math.max(0, animes.findIndex((anime) => anime.anilistId === restoreId)))
  }
  const [initialFocusDone, setInitialFocusDone] = useState(false)

  const padding = remToPx(ROW_PADDING_REM)
  const posterWidth = remToPx(POSTER_WIDTH_REM)
  const gap = remToPx(POSTER_GAP_REM)
  const virtualizer = useVirtualizer({
    count: animes.length,
    horizontal: true,
    getScrollElement: () => ref.current,
    estimateSize: () => posterWidth,
    gap,
    overscan: OVERSCAN,
    paddingStart: padding,
    paddingEnd: padding,
    scrollPaddingStart: padding,
    scrollPaddingEnd: padding,
    // Restaurando um pôster mais adiante, a linha já monta rolada até ele.
    initialOffset: () => (initialIndex ?? 0) * (posterWidth + gap),
    observeElementRect: observeVisibleRect,
  })

  // Último estado da query num ref: o callback de foco fica estável e os
  // pôsteres memoizados não re-renderizam quando uma página nova chega.
  const latest = useRef({ query, total: animes.length })
  useLayoutEffect(() => {
    latest.current = { query, total: animes.length }
  })

  const handleFocused = useCallback(
    (anime: AnimeBindingSummary, index: number) => {
      // Decide pelo alvo pendente, não pela posição: com a seta segurada a
      // rolagem ainda está a caminho do passo anterior.
      const track = ref.current
      const start = virtualizer.getOffsetForIndex(index, 'start')?.[0]
      const end = virtualizer.getOffsetForIndex(index, 'end')?.[0]
      if (track && start !== undefined && end !== undefined) {
        const current = scrollTarget(track).left
        if (start < current) smoothScrollTo(track, { left: start })
        else if (end > current) smoothScrollTo(track, { left: end })
      }
      setInitialFocusDone(true)
      focusMemory.set(rowFocusKey, anime.anilistId)
      if (sectionRef.current) onFocused(list, anime, sectionRef.current)

      const { query: current, total } = latest.current
      if (index >= total - PREFETCH_ITEMS && current.hasNextPage && !current.isFetchingNextPage) {
        void current.fetchNextPage()
      }
    },
    [virtualizer, rowFocusKey, list, onFocused, ref],
  )

  return (
    <section
      ref={sectionRef}
      aria-label={list.name}
      // Lista sem itens some: não ocupa espaço nem entra na navegação.
      hidden={query.isSuccess && animes.length === 0}
      style={{ height: `${POSTER_ROW_HEIGHT_REM}rem`, contain: 'layout paint' }}
    >
      {query.isPending && <PosterRowSkeleton holdFocus={autoFocus} />}
      {query.isError && (
        <p
          className="flex items-center text-[1.75rem] text-muted-foreground"
          style={{ height: `${POSTER_ROW_HEIGHT_REM}rem`, paddingInline: `${ROW_PADDING_REM}rem` }}
        >
          Não foi possível carregar “{list.name}” ({query.error.message})
        </p>
      )}

      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref}
          className="overflow-x-auto [scrollbar-width:none]"
          style={{ height: animes.length > 0 ? `${POSTER_ROW_HEIGHT_REM}rem` : 0 }}
        >
          <div className="relative h-full" style={{ width: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const anime = animes[item.index]
              if (!anime) return null
              return (
                // Posição por `left`, não `transform`: posição estática, não animação (seção 7).
                <div
                  key={anime.anilistId}
                  className="absolute"
                  style={{ top: padding, left: item.start }}
                >
                  <AnimeSummaryPoster
                    anime={anime}
                    index={item.index}
                    autoFocus={autoFocus && !initialFocusDone && item.index === initialIndex}
                    onFocused={handleFocused}
                    onSelect={onSelect}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </FocusContext.Provider>
    </section>
  )
})
