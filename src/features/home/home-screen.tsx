import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { PlaceholderTile } from '@/ui/placeholder-tile'

const ROWS = ['Continuar assistindo', 'Adicionados recentemente']
const ITEMS_PER_ROW = 5

export const HOME_FOCUS_KEY = 'HOME'

/**
 * Placeholder da tela Início: só a estrutura (linhas de itens focáveis) para
 * validar navegação e foco. O conteúdo real entra na fase 4 da especificação.
 */
export function HomeScreen() {
  const { ref, focusKey } = useFocusable({
    focusKey: HOME_FOCUS_KEY,
    saveLastFocusedChild: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} aria-label="Início" className="flex flex-col gap-12">
        <h1 className="text-[3rem] font-medium">Início</h1>

        {ROWS.map((title, rowIndex) => (
          <div key={title} className="flex flex-col gap-4">
            <h2 className="text-muted-foreground text-[1.75rem]">{title}</h2>
            <div className="flex gap-6">
              {Array.from({ length: ITEMS_PER_ROW }, (_, index) => (
                <PlaceholderTile
                  key={index}
                  label={`Item ${index + 1}`}
                  autoFocus={rowIndex === 0 && index === 0}
                  className="h-[10rem] w-[17.75rem]"
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </FocusContext.Provider>
  )
}
