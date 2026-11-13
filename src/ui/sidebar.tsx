import { memo, useCallback, type ReactNode } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { House, Search, type LucideIcon } from 'lucide-react'
import { activeProfile } from '@/lib/profile'
import { useStore } from '@/lib/store'
import { Focusable } from './focusable'
import { ProfileAvatar } from './profile-avatar'

const ITEMS = [
  { key: 'home', label: 'Início', icon: House },
  { key: 'search', label: 'Buscar', icon: Search },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  icon: LucideIcon
}>

// Trocar perfil fica sozinho na base, com o avatar do perfil atual no lugar do ícone.
const PROFILES_KEY = 'profiles'

export type SidebarItemKey = (typeof ITEMS)[number]['key'] | typeof PROFILES_KEY

function itemFocusKey(key: SidebarItemKey): string {
  return `SIDEBAR_${key}`
}

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
const EXPANDED_REM = 19.5
const ROW_PADDING_REM = 1
const ICON_SLOT_REM = 3
// Brilho atrás do logo com o painel aberto: o mesmo laranja da lanterna da
// seleção de perfis, um degradê fixo (sem blur, seção 7). Abrindo, ele se
// espalha a partir da lanterna (cresce e acende). Só transform e opacity
// animam.
const LOGO_GLOW =
  'radial-gradient(circle, rgb(255 105 0 / 0.28), transparent 65%)'
const LOGO_EXPANDED_SCALE = 1.6

// Abrir e fechar a sidebar é uma animação só: o painel, os rótulos, o
// deslize e o crescimento da lanterna e o brilho começam e terminam juntos,
// com a mesma duração e curva. Fechar é mais rápido, para devolver logo a
// tela.
const EXPAND_OPEN_MS = 400
const EXPAND_CLOSE_MS = 160

function expandTransition(expanded: boolean, ...properties: string[]): string {
  const ms = expanded ? EXPAND_OPEN_MS : EXPAND_CLOSE_MS
  return properties.map((property) => `${property} ${ms}ms ease-out`).join(', ')
}
// Distância do centro da coluna dos ícones até o centro do painel aberto.
const LOGO_EXPANDED_SHIFT_REM =
  EXPANDED_REM / 2 - (EDGE_REM + ROW_PADDING_REM + ICON_SLOT_REM / 2)

interface SidebarItemProps {
  itemKey: SidebarItemKey
  label: string
  /** Ícone do item; ou, no lugar dele, `avatar` (já na cor própria, não muda com o foco). */
  icon?: LucideIcon
  avatar?: ReactNode
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
  avatar,
  expanded,
  active,
  onSelect,
}: SidebarItemProps) {
  const handleEnterPress = useCallback(
    () => onSelect?.(itemKey),
    [onSelect, itemKey],
  )

  return (
    <Focusable focusKey={itemFocusKey(itemKey)} onEnterPress={handleEnterPress}>
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
            {avatar}
            {Icon && (
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
            )}
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
              transition: expandTransition(expanded, 'opacity', 'transform'),
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
    // Entrar pela seta cai sempre na aba da tela atual (sem aba, no primeiro
    // item), nunca no item mais perto de onde estava o foco: com "Trocar
    // perfil" na base, a seta esquerda de um pôster embaixo cairia nele.
    preferredChildFocusKey: activeKey ? itemFocusKey(activeKey) : undefined,
    // O padrão da lib é lembrar o último item, que passaria na frente da aba.
    saveLastFocusedChild: false,
    trackChildren: true,
  })
  const profile = useStore(activeProfile)

  return (
    <FocusContext.Provider value={focusKey}>
      <nav
        ref={ref}
        aria-label="Menu principal"
        data-app-chrome
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
            transition: expandTransition(
              hasFocusedChild,
              'opacity',
              'transform',
            ),
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
          {/* `logo.png` é o ícone com o fundo transparente (o `icon.png` tem
              fundo #110c08 e viraria um quadrado sobre o painel ou o banner).
              Aberto, o bloco desliza pro centro do painel no tempo dele, e
              a lanterna cresce junto com o brilho que acende atrás dela —
              só transform e opacity, como o resto do painel (seção 7). */}
          <div
            className="relative size-16 shrink-0"
            style={{
              transform: hasFocusedChild
                ? `translateX(${LOGO_EXPANDED_SHIFT_REM}rem)`
                : 'none',
              transition: expandTransition(hasFocusedChild, 'transform'),
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 size-90 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: LOGO_GLOW,
                opacity: hasFocusedChild ? 1 : 0,
                transform: hasFocusedChild ? 'scale(1)' : 'scale(0.3)',
                transition: expandTransition(
                  hasFocusedChild,
                  'opacity',
                  'transform',
                ),
              }}
            />
            <img
              src="/logo.png"
              alt="Akari TV"
              className="relative size-16 max-w-none"
              style={{
                transform: hasFocusedChild
                  ? `scale(${LOGO_EXPANDED_SCALE})`
                  : 'none',
                transition: expandTransition(hasFocusedChild, 'transform'),
              }}
            />
          </div>
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

        <div className="relative mt-auto">
          <SidebarItem
            itemKey={PROFILES_KEY}
            label="Trocar perfil"
            avatar={<ProfileAvatar profile={profile} sizeRem={2.75} />}
            expanded={hasFocusedChild}
            active={false}
            onSelect={onSelect}
          />
        </div>
      </nav>
    </FocusContext.Provider>
  )
})

export { COLLAPSED_REM as SIDEBAR_COLLAPSED_REM }
