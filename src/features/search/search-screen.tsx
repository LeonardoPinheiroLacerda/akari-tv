import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { PlaceholderTile } from '@/ui/placeholder-tile'

const RESULTS = 4

export const SEARCH_FOCUS_KEY = 'SEARCH'

/**
 * Placeholder da tela Buscar: campo e resultados como blocos focáveis, sem
 * teclado nem API. A busca real entra na fase 5 da especificação.
 */
export function SearchScreen() {
  const { ref, focusKey } = useFocusable({
    focusKey: SEARCH_FOCUS_KEY,
    saveLastFocusedChild: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} aria-label="Buscar" className="flex flex-col gap-12">
        <h1 className="text-[3rem] font-medium">Buscar</h1>

        <PlaceholderTile
          label="Digite para buscar…"
          autoFocus
          className="h-20 w-[48rem] justify-start px-8"
        />

        <div className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-[1.75rem]">Resultados</h2>
          <div className="flex gap-6">
            {Array.from({ length: RESULTS }, (_, index) => (
              <PlaceholderTile
                key={index}
                label={`Resultado ${index + 1}`}
                className="h-[15rem] w-[10rem]"
              />
            ))}
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  )
}
