import { memo } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { Focusable } from './focusable'

const ITEMS = [
  { key: 'home', label: 'Início' },
  { key: 'search', label: 'Buscar' },
] as const

type SidebarItemKey = (typeof ITEMS)[number]['key']

interface SidebarProps {
  onSelect?: (key: SidebarItemKey) => void
}

// Larguras em "dp de design" (seção 3). Recolhida cobre só a margem de
// overscan (96dp = 6rem) mais o ícone; expandida abre espaço pros rótulos.
const COLLAPSED_REM = 10
const EXPANDED_REM = 20

/**
 * Região própria de navegação espacial (seção 6: "um FocusContext por
 * região"). Recolhida por padrão — só o ícone, dentro da margem de overscan
 * — e expande ao ganhar foco (seção 7: "o menu lateral expande com transform
 * sobre o conteúdo, não com width"). O painel de fundo cresce via
 * `scaleX` (seguro para uma cor sólida); ícone e rótulos nunca escalam —
 * só opacity/posição, pra não distorcer texto.
 */
export const Sidebar = memo(function Sidebar({ onSelect }: SidebarProps) {
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'SIDEBAR',
    saveLastFocusedChild: true,
    trackChildren: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <nav
        ref={ref}
        aria-label="Menu principal"
        className="fixed inset-y-0 left-0 z-10 flex flex-col items-center pt-[3.375rem] pb-[3.375rem]"
        style={{ width: `${EXPANDED_REM}rem` }}
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 bg-surface"
          style={{
            width: `${EXPANDED_REM}rem`,
            transformOrigin: 'left',
            transform: `scaleX(${hasFocusedChild ? 1 : COLLAPSED_REM / EXPANDED_REM})`,
            transition: 'transform 160ms',
          }}
        />

        <div
          className="relative z-10 flex shrink-0 self-start justify-center"
          style={{ width: `${COLLAPSED_REM}rem` }}
        >
          <img src="/icon.png" alt="Akari TV" className="h-12 w-12" />
        </div>

        <div
          className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10"
          style={{ opacity: hasFocusedChild ? 1 : 0, transition: 'opacity 160ms' }}
        >
          {ITEMS.map((item) => (
            <Focusable key={item.key} onEnterPress={() => onSelect?.(item.key)}>
              {(focused) => (
                <div
                  className="rounded-md px-4 py-2"
                  style={{
                    transform: focused ? 'scale(1.06)' : 'scale(1)',
                    outlineStyle: 'solid',
                    outlineWidth: 4,
                    outlineOffset: 2,
                    outlineColor: focused ? 'var(--color-brand)' : 'transparent',
                    transition: 'transform 120ms, outline-color 120ms',
                  }}
                >
                  <span
                    className="text-[1.75rem] whitespace-nowrap"
                    style={{ color: focused ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                  >
                    {item.label}
                  </span>
                </div>
              )}
            </Focusable>
          ))}
        </div>
      </nav>
    </FocusContext.Provider>
  )
})

export { COLLAPSED_REM as SIDEBAR_COLLAPSED_REM }
