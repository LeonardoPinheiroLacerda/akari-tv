import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useScreenFocusable } from '@/app/screen'
import type { AnimeResponse } from '@/api/generated/akariAPI.schemas'
import { useGetAnimeFranchise } from '@/api/generated/anime-relations/anime-relations'
import { PUSHED_SCREEN } from '@/lib/navigation'
import { createStore } from '@/lib/store'
import { AnimeHero } from '@/ui/anime-hero'
import { POSTER_ROW_HEIGHT_REM, PosterRow } from '@/ui/poster-row'
import { FranchiseTabs, TABS_HEIGHT_REM } from './franchise-tabs'

const ANIME_FOCUS_KEY = 'ANIME'

/** Rota `/anime/:anilistId`: uma instância por anime, para trocar de anime zerar o estado. */
export function AnimeRoute() {
  const { anilistId } = useParams()
  return <AnimeScreen key={anilistId} anilistId={Number(anilistId)} />
}

interface AnimeScreenProps {
  anilistId: number
}

/**
 * Detalhe do anime: o mesmo hero fixo da Início e, embaixo, a franquia em
 * abas — Temporadas, Filmes e Especiais, com a contagem de cada uma, na ordem
 * e classificação que o backend entrega (`GET .../franchise`). As abas ficam
 * sempre visíveis, para nada da franquia passar despercebido; a linha de
 * pôsteres abaixo mostra a aba ativa e rola na horizontal. Aba vazia não
 * aparece.
 */
function AnimeScreen({ anilistId }: AnimeScreenProps) {
  const { ref, focusKey } = useScreenFocusable({ focusKey: ANIME_FOCUS_KEY })
  const [heroStore] = useState(() => createStore<AnimeResponse | undefined>(undefined))

  const query = useGetAnimeFranchise(anilistId, {
    query: { enabled: Number.isInteger(anilistId) },
  })

  // Até algum pôster ganhar foco, o hero mostra a raiz da franquia. O foco
  // automático da primeira linha chega antes deste efeito e tem prioridade.
  useEffect(() => {
    if (query.data && heroStore.get() === undefined) heroStore.set(query.data.root)
  }, [query.data, heroStore])

  const groups = useMemo(() => {
    const data = query.data
    const group = (key: string, label: string, animes?: AnimeResponse[] | null) => ({
      key,
      label,
      animes: animes ?? [],
      count: animes?.length ?? 0,
    })
    return [
      group('seasons', 'Temporadas', data?.seasons),
      group('movies', 'Filmes', data?.movies),
      group('specials', 'Especiais', data?.specials),
    ].filter((entry) => entry.count > 0)
  }, [query.data])

  const [selectedKey, setSelectedKey] = useState<string>()
  const active = groups.find((group) => group.key === selectedKey) ?? groups[0]
  // Só a primeira linha mostrada recebe o foco inicial; trocar de aba deixa o
  // foco na aba, sem puxá-lo para os pôsteres.
  const [autoFocusPosters, setAutoFocusPosters] = useState(true)

  const handleFocusTab = useCallback((key: string) => {
    setSelectedKey(key)
    setAutoFocusPosters(false)
  }, [])

  const handleFocused = useCallback((anime: AnimeResponse) => heroStore.set(anime), [heroStore])

  const navigate = useNavigate()
  const handleSelect = useCallback(
    (anime: AnimeResponse) =>
      navigate(`/anime/${anime.anilistId}/episodes`, { state: PUSHED_SCREEN }),
    [navigate],
  )

  return (
    <FocusContext.Provider value={focusKey}>
      <section
        ref={ref}
        aria-label={query.data?.root.titles?.main ?? 'Anime'}
        className="flex h-[calc(100svh-6.75rem)] flex-col"
      >
        <AnimeHero store={heroStore} expandableSynopsis />

        <div
          className="mt-2 shrink-0"
          style={{ height: `${TABS_HEIGHT_REM + POSTER_ROW_HEIGHT_REM}rem` }}
        >
          {query.isPending && <p className="text-[1.75rem] text-muted-foreground">Carregando…</p>}
          {query.isError && (
            <p className="text-[1.75rem] text-muted-foreground">
              Não foi possível carregar a franquia ({query.error.message})
            </p>
          )}
          {active && (
            <>
              <FranchiseTabs tabs={groups} activeKey={active.key} onFocusTab={handleFocusTab} />
              <PosterRow
                key={active.key}
                focusKey={`ANIME_ROW_${active.key}`}
                animes={active.animes}
                autoFocusFirst={autoFocusPosters}
                onFocused={handleFocused}
                onSelect={handleSelect}
              />
            </>
          )}
        </div>
      </section>
    </FocusContext.Provider>
  )
}
