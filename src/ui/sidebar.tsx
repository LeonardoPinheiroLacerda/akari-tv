import { memo, useCallback } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { House, Search, type LucideIcon } from 'lucide-react'
import { Focusable } from './focusable'

const ITEMS = [
  { key: 'home', label: 'Início', icon: House },
  { key: 'search', label: 'Buscar', icon: Search },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  icon: LucideIcon
}>

export type SidebarItemKey = (typeof ITEMS)[number]['key']

interface SidebarProps {
  /** Item da tela atual: destacado em laranja mesmo sem foco. */
  activeKey?: SidebarItemKey
  onSelect?: (key: SidebarItemKey) => void
}

// Larguras em "dp de design" (seção 3). A coluna dos ícones começa na margem
// lateral de overscan (32dp = 2rem); recolhida mostra só essa coluna,
// expandida abre espaço pros rótulos. A pílula de foco vai da
// margem até 1,5rem antes da borda.
const EDGE_REM = 2
const COLLAPSED_REM = 8
const EXPANDED_REM = 15
const ROW_PADDING_REM = 1
const ICON_SLOT_REM = 3
// Distância do centro da coluna dos ícones até o centro do painel aberto.
const LOGO_EXPANDED_SHIFT_REM =
  EXPANDED_REM / 2 - (EDGE_REM + ROW_PADDING_REM + ICON_SLOT_REM / 2)

interface SidebarItemProps {
  itemKey: SidebarItemKey
  label: string
  icon: LucideIcon
  expanded: boolean
  active: boolean
  onSelect?: (key: SidebarItemKey) => void
}

/**
 * Foco como pílula de largura fixa numa camada própria (APRENDIZADOS.md):
 * só opacity/transform animam; a troca de cor do texto/ícone é instantânea,
 * coberta pelo fade da pílula.
 */
const SidebarItem = memo(function SidebarItem({
  itemKey,
  label,
  icon: Icon,
  expanded,
  active,
  onSelect,
}: SidebarItemProps) {
  const handleEnterPress = useCallback(
    () => onSelect?.(itemKey),
    [onSelect, itemKey],
  )

  return (
    <Focusable onEnterPress={handleEnterPress}>
      {(focused) => (
        <div
          className="relative flex h-16 items-center"
          style={{
            width: `${EXPANDED_REM - EDGE_REM - 1.5}rem`,
            paddingLeft: `${ROW_PADDING_REM}rem`,
            transform: focused ? 'scale(1.04)' : 'scale(1)',
            transformOrigin: 'left center',
            transition: 'transform 120ms',
          }}
        >
          <div
            aria-hidden
            className="bg-brand absolute inset-0 rounded-xl"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          <span
            className="relative flex shrink-0 justify-center"
            style={{ width: `${ICON_SLOT_REM}rem` }}
          >
            <Icon
              aria-hidden
              className="size-8"
              strokeWidth={2.25}
              color={
                focused
                  ? 'var(--color-bg)'
                  : active
                    ? 'var(--color-brand)'
                    : expanded
                      ? 'var(--color-text)'
                      : 'var(--color-text-muted)'
              }
            />
          </span>
          <span
            className="relative ml-4 text-[1.75rem] font-medium whitespace-nowrap"
            style={{
              color: focused
                ? 'var(--color-bg)'
                : active
                  ? 'var(--color-text)'
                  : 'var(--color-text-muted)',
              opacity: expanded ? 1 : 0,
              transform: expanded ? 'translateX(0)' : 'translateX(-0.75rem)',
              transition: 'opacity 160ms, transform 160ms',
            }}
          >
            {label}
          </span>
        </div>
      )}
    </Focusable>
  )
})

/**
 * Região própria de navegação espacial (seção 6: "um FocusContext por
 * região"). Recolhida por padrão — só a coluna de ícones sobre o fundo da
 * tela — e expande ao ganhar foco (seção 7: "o menu lateral expande com
 * transform sobre o conteúdo, não com width"): o painel entra com
 * opacity + translateX e uma borda em degradê estático; ícones e rótulos
 * nunca escalam com o painel, pra não distorcer texto.
 */
export const Sidebar = memo(function Sidebar({
  activeKey,
  onSelect,
}: SidebarProps) {
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
        className="fixed inset-y-0 left-0 z-10 flex flex-col py-[3.375rem]"
        // Largura recolhida, com painel e pílulas transbordando: o norigin
        // compara a caixa da região da sidebar com a da região da tela, e com
        // a largura expandida ela invadiria o x do conteúdo — a seta esquerda
        // não acharia a sidebar "à esquerda" da tela.
        style={{
          width: `${COLLAPSED_REM}rem`,
          paddingLeft: `${EDGE_REM}rem`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 flex"
          style={{
            opacity: hasFocusedChild ? 1 : 0,
            transform: hasFocusedChild ? 'translateX(0)' : 'translateX(-4rem)',
            transition: 'opacity 160ms, transform 160ms',
          }}
        >
          <div
            className="bg-surface h-full"
            style={{ width: `${EXPANDED_REM}rem` }}
          />
          <div className="from-surface h-full w-16 bg-linear-to-r to-transparent" />
        </div>

        <div
          className="relative flex justify-center"
          style={{
            width: `${ICON_SLOT_REM}rem`,
            marginLeft: `${ROW_PADDING_REM}rem`,
          }}
        >
          {/* O fundo do ícone é o --color-bg; `lighten` o funde com a superfície
              mais clara do painel aberto em vez de aparecer como um quadrado.
              Aberto, o logo desliza pro centro do painel e cresce — só
              transform, como o resto do painel (seção 7). */}
          <img
            src="/icon.png"
            alt="Akari TV"
            className="size-16 max-w-none shrink-0 mix-blend-lighten"
            style={{
              transform: hasFocusedChild
                ? `translateX(${LOGO_EXPANDED_SHIFT_REM}rem) scale(1.25)`
                : 'none',
              transition: 'transform 160ms',
            }}
          />
        </div>

        <div className="relative mt-16 flex flex-col gap-3">
          {ITEMS.map((item) => (
            <SidebarItem
              key={item.key}
              itemKey={item.key}
              label={item.label}
              icon={item.icon}
              expanded={hasFocusedChild}
              active={item.key === activeKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      </nav>
    </FocusContext.Provider>
  )
})

export { COLLAPSED_REM as SIDEBAR_COLLAPSED_REM }
