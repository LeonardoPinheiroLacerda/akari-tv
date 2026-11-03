import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { keepPreviousData } from '@tanstack/react-query'
import { CalendarDays, Clapperboard, Layers, Search, Tv } from 'lucide-react'
import type { FranchiseSummary } from '@/api/generated/akariAPI.schemas'
import { useListFranchisesInfinite } from '@/api/generated/anime-franchise/anime-franchise'
import { pageInfiniteOptions } from '@/api/pagination'
import { ScreenActiveContext, useScreenFocusable } from '@/app/screen'
import { formatLabel } from '@/lib/format'
import { remToPx } from '@/lib/layout'
import { PUSHED_SCREEN } from '@/lib/navigation'
import { createStore, useStore, type Store } from '@/lib/store'
import { InfoBadge } from '@/ui/info-badge'
import { SkeletonGroup } from '@/ui/skeleton'
import { Spinner } from '@/ui/spinner'
import {
  FRANCHISE_POSTER_HEIGHT_REM,
  FranchisePoster,
  FranchisePosterSkeleton,
} from './franchise-poster'
import {
  KEY_BACKSPACE,
  KEY_CLEAR,
  KEYBOARD_WIDTH_REM,
  SearchKeyboard,
} from './search-keyboard'

export const SEARCH_FOCUS_KEY = 'SEARCH'
const KEYBOARD_FOCUS_KEY = 'SEARCH_KEYBOARD'

const PAGE_SIZE = 30
const COLUMNS = 5
// Carrega a próxima página quando o foco chega a 2 linhas do fim do que já veio.
const PREFETCH_ROWS = 2
// Espera entre a última tecla e a busca, para não disparar uma chamada por letra.
const DEBOUNCE_MS = 300
const MAX_QUERY_LENGTH = 60
// Folga em volta da grade dentro do overflow: cobre o contorno e o scale do
// pôster focado, que senão seriam cortados.
const GRID_PADDING_REM = 1.25

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

function applyKey(query: string, value: string): string {
  if (value === KEY_BACKSPACE) return query.slice(0, -1)
  if (value === KEY_CLEAR) return ''
  // Sem espaço no começo nem dois seguidos: não mudam a busca e só confundem o campo.
  if (value === ' ' && (query === '' || query.endsWith(' '))) return query
  return (query + value).slice(0, MAX_QUERY_LENGTH)
}

/** Campo de busca (só exibição): o texto vem do teclado na tela ou do físico. */
function SearchField({ query }: { query: string }) {
  return (
    <div
      className="bg-surface flex h-20 items-center gap-4 rounded-2xl border px-6"
      style={{ width: `${KEYBOARD_WIDTH_REM}rem` }}
    >
      <Search
        aria-hidden
        className="size-8 shrink-0"
        strokeWidth={2.25}
        color="var(--color-brand)"
      />
      <p
        aria-live="polite"
        className="flex min-w-0 flex-1 items-center text-[2rem] leading-none"
      >
        {query ? (
          <span className="truncate whitespace-pre">{query}</span>
        ) : (
          <span className="text-muted-foreground truncate">Buscar animes…</span>
        )}
        <span
          aria-hidden
          className="bg-brand ml-1 h-9 w-[0.1875rem] shrink-0 animate-pulse rounded-full"
        />
      </p>
    </div>
  )
}

/** Detalhe da franquia em foco, sob o teclado. Lê o store: só ele re-renderiza no foco. */
const FocusedFranchise = memo(function FocusedFranchise({
  store,
}: {
  store: Store<FranchiseSummary | undefined>
}) {
  const franchise = useStore(store)
  if (!franchise) return null
  const { root, memberCount } = franchise

  return (
    <div
      className="flex flex-col gap-4"
      style={{ width: `${KEYBOARD_WIDTH_REM}rem` }}
    >
      <p className="line-clamp-2 text-[2.25rem] leading-tight font-medium">
        {root.title}
      </p>
      <div className="flex flex-wrap gap-3">
        <InfoBadge
          icon={Layers}
          label={memberCount === 1 ? '1 título' : `${memberCount} títulos`}
          iconColor="var(--color-brand)"
        />
        {root.format && (
          <InfoBadge icon={Tv} label={formatLabel(root.format)} />
        )}
        {root.year && (
          <InfoBadge icon={CalendarDays} label={String(root.year)} />
        )}
        {root.studio && <InfoBadge icon={Clapperboard} label={root.studio} />}
      </div>
    </div>
  )
})

interface ResultsGridProps {
  franchises: FranchiseSummary[]
  onFocused: (
    franchise: FranchiseSummary,
    index: number,
    node: HTMLElement,
  ) => void
  onSelect: (franchise: FranchiseSummary) => void
  scrollRef: RefObject<HTMLDivElement | null>
}

/** Grade de resultados: região própria, que guarda o último pôster focado. */
const ResultsGrid = memo(function ResultsGrid({
  franchises,
  onFocused,
  onSelect,
  scrollRef,
}: ResultsGridProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'SEARCH_RESULTS',
    saveLastFocusedChild: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto"
        style={{ padding: `${GRID_PADDING_REM}rem` }}
      >
        <div
          ref={ref}
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, max-content)` }}
        >
          {franchises.map((franchise, index) => (
            <FranchisePoster
              key={franchise.root.anilistId}
              franchise={franchise}
              index={index}
              autoFocus={false}
              onFocused={onFocused}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  )
})

/**
 * Buscar: à esquerda o campo, o teclado na tela e o detalhe da franquia em
 * foco; à direita, os resultados em grade com paginação infinita. Busca as
 * franquias da coleção (`GET /v1/metadata/franchises?q=`) — o texto casa com o
 * título da raiz ou de qualquer membro, então buscar uma temporada acha a
 * franquia dela; animes ocultos não aparecem. Sem texto, lista todas, na ordem
 * do backend. O teclado físico também digita (navegador). OK numa franquia
 * abre o detalhe dela, como na Início.
 */
export function SearchScreen() {
  const { ref, focusKey } = useScreenFocusable({ focusKey: SEARCH_FOCUS_KEY })
  const active = useContext(ScreenActiveContext)
  const [focusedStore] = useState(() =>
    createStore<FranchiseSummary | undefined>(undefined),
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const term = useDebouncedValue(query.trim(), DEBOUNCE_MS)

  const results = useListFranchisesInfinite(
    { size: PAGE_SIZE, ...(term ? { q: term } : {}) },
    { query: { ...pageInfiniteOptions, placeholderData: keepPreviousData } },
  )
  const franchises = useMemo(
    () => results.data?.pages.flatMap((page) => page.data) ?? [],
    [results.data],
  )
  const total = results.data?.pages[0]?.totalElements

  // Resultados novos: volta a grade pro topo e limpa o detalhe da busca anterior.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    focusedStore.set(undefined)
  }, [term, focusedStore])

  const handleKey = useCallback(
    (value: string) => setQuery((current) => applyKey(current, value)),
    [],
  )

  // Teclado físico (navegador): digita e apaga sem passar pelo teclado na
  // tela. Em captura, para o Backspace apagar antes de o Voltar (app/back.ts)
  // tratá-lo; com o campo vazio, ele segue como Voltar.
  const latestQuery = useRef(query)
  useLayoutEffect(() => {
    latestQuery.current = query
  })
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const typed = event.key.length === 1
      const erase = event.key === 'Backspace' && latestQuery.current !== ''
      if (!typed && !erase) return
      event.preventDefault()
      event.stopImmediatePropagation()
      handleKey(erase ? KEY_BACKSPACE : event.key.toLowerCase())
      // Digitar com o foco nos resultados os trocaria por baixo do foco.
      setFocus(KEYBOARD_FOCUS_KEY)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, handleKey])

  // Último estado da query num ref: o callback de foco fica estável e os
  // pôsteres memoizados não re-renderizam quando uma página nova chega.
  const latest = useRef({ results, total: franchises.length })
  useLayoutEffect(() => {
    latest.current = { results, total: franchises.length }
  })

  const handleFocused = useCallback(
    (franchise: FranchiseSummary, index: number, node: HTMLElement) => {
      focusedStore.set(franchise)

      scrollRef.current?.scrollTo({
        top: Math.max(0, node.offsetTop - remToPx(GRID_PADDING_REM)),
        behavior: 'smooth',
      })

      const { results: current, total: loaded } = latest.current
      if (
        index >= loaded - COLUMNS * PREFETCH_ROWS &&
        current.hasNextPage &&
        !current.isFetchingNextPage
      ) {
        void current.fetchNextPage()
      }
    },
    [focusedStore],
  )

  const navigate = useNavigate()
  const handleSelect = useCallback(
    (franchise: FranchiseSummary) =>
      navigate(`/anime/${franchise.root.anilistId}`, { state: PUSHED_SCREEN }),
    [navigate],
  )

  const heading = term ? `Resultados para “${term}”` : 'Todas as franquias'
  const searching = results.isFetching && !results.isFetchingNextPage

  return (
    <FocusContext.Provider value={focusKey}>
      <section
        ref={ref}
        aria-label="Buscar"
        className="flex h-[calc(100svh-6.75rem)] gap-12"
      >
        <div className="flex shrink-0 flex-col gap-8">
          <SearchField query={query} />
          <SearchKeyboard autoFocus onPress={handleKey} />
          <FocusedFranchise store={focusedStore} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex h-20 items-center gap-4"
            style={{ paddingInline: `${GRID_PADDING_REM}rem` }}
          >
            <h1 className="truncate text-[2.25rem] font-medium">{heading}</h1>
            {total !== undefined && (
              <span className="text-muted-foreground shrink-0 text-[1.75rem]">
                {total === 1 ? '1 franquia' : `${total} franquias`}
              </span>
            )}
            {searching && <Spinner sizeRem={2.5} label="Buscando" />}
          </div>

          {results.isPending && (
            // O foco já está no teclado: o skeleton não precisa segurá-lo.
            <SkeletonGroup
              label="Carregando franquias"
              className="grid min-h-0 flex-1 content-start gap-6 overflow-hidden"
              style={{
                padding: `${GRID_PADDING_REM}rem`,
                gridTemplateColumns: `repeat(${COLUMNS}, max-content)`,
              }}
            >
              {Array.from({ length: COLUMNS * 2 }, (_, index) => (
                <FranchisePosterSkeleton key={index} />
              ))}
            </SkeletonGroup>
          )}
          {results.isError && (
            <p
              className="text-muted-foreground text-[1.75rem]"
              style={{ padding: `${GRID_PADDING_REM}rem` }}
            >
              Não foi possível buscar ({results.error.message})
            </p>
          )}
          {results.isSuccess && franchises.length === 0 && (
            <div
              className="text-muted-foreground flex flex-col items-center justify-center gap-4 text-center"
              style={{ height: `${FRANCHISE_POSTER_HEIGHT_REM}rem` }}
            >
              <Search aria-hidden className="size-16" strokeWidth={1.5} />
              <p className="text-[1.75rem]">
                {term
                  ? `Nenhuma franquia encontrada para “${term}”`
                  : 'Nenhuma franquia na coleção'}
              </p>
            </div>
          )}

          {!results.isPending && (
            <ResultsGrid
              franchises={franchises}
              onFocused={handleFocused}
              onSelect={handleSelect}
              scrollRef={scrollRef}
            />
          )}
        </div>
      </section>
    </FocusContext.Provider>
  )
}
