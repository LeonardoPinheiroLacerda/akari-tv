import { memo, useCallback } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { Focusable } from '@/ui/focusable'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ROW_PADDING_REM } from '@/ui/poster-row'

export const TABS_HEIGHT_REM = 4

interface FranchiseTab {
  key: string
  label: string
  count: number
}

function tabFocusKey(key: string): string {
  return `ANIME_TAB_${key}`
}

interface FranchiseTabItemProps {
  tab: FranchiseTab
  active: boolean
  onFocusTab: (key: string) => void
}

/**
 * Aba com contagem. Foco como pílula laranja (mesma linguagem da sidebar) e a
 * aba ativa sem foco com fundo sutil — cada estado numa camada própria, só
 * opacity/transform animam (seção 7, APRENDIZADOS.md).
 */
const FranchiseTabItem = memo(function FranchiseTabItem({
  tab,
  active,
  onFocusTab,
}: FranchiseTabItemProps) {
  const handleFocus = useCallback(() => onFocusTab(tab.key), [onFocusTab, tab.key])

  return (
    <Focusable focusKey={tabFocusKey(tab.key)} onFocus={handleFocus}>
      {(focused) => (
        <div
          role="tab"
          aria-selected={active}
          className="relative flex h-12 items-center gap-3 rounded-full px-5"
          style={{
            transform: focused ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 120ms',
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-surface-elevated"
            style={{ opacity: active && !focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-brand"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          <span
            className="relative text-[1.75rem] font-medium whitespace-nowrap"
            style={{
              color: focused
                ? 'var(--color-bg)'
                : active
                  ? 'var(--color-text)'
                  : 'var(--color-text-muted)',
            }}
          >
            {tab.label}
          </span>
          <span
            className="relative text-[1.75rem] whitespace-nowrap"
            style={{
              color: focused ? 'var(--color-bg)' : 'var(--color-text-muted)',
              opacity: focused ? 0.8 : 1,
            }}
          >
            {tab.count}
          </span>
        </div>
      )}
    </Focusable>
  )
})

interface FranchiseTabsProps {
  tabs: FranchiseTab[]
  activeKey: string
  /** Focar uma aba já a seleciona (sem OK): a linha abaixo troca na hora. */
  onFocusTab: (key: string) => void
}

/**
 * Abas da franquia (Temporadas · Filmes · Especiais) com a contagem de cada
 * uma, sempre visíveis: o usuário vê tudo o que a franquia tem sem precisar
 * descobrir rolando. Região própria de foco; entrar nela pela seta (subindo
 * dos pôsteres) cai sempre na aba ativa, nunca na mais próxima — senão subir
 * a partir de "Filmes" trocaria sozinho para "Temporadas".
 */
export const FranchiseTabs = memo(function FranchiseTabs({
  tabs,
  activeKey,
  onFocusTab,
}: FranchiseTabsProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'ANIME_TABS',
    preferredChildFocusKey: tabFocusKey(activeKey),
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        role="tablist"
        className="flex items-end gap-3"
        style={{ height: `${TABS_HEIGHT_REM}rem`, paddingLeft: `${ROW_PADDING_REM}rem` }}
      >
        {tabs.map((tab) => (
          <FranchiseTabItem
            key={tab.key}
            tab={tab}
            active={tab.key === activeKey}
            onFocusTab={onFocusTab}
          />
        ))}
      </div>
    </FocusContext.Provider>
  )
})

/** Abas carregando: pílulas na altura das reais, alinhadas pela base como elas. */
export function FranchiseTabsSkeleton() {
  return (
    <SkeletonGroup
      className="flex items-end gap-3"
      style={{ height: `${TABS_HEIGHT_REM}rem`, paddingLeft: `${ROW_PADDING_REM}rem` }}
    >
      <Skeleton className="h-12 w-[13rem] rounded-full" />
      <Skeleton className="h-12 w-[9rem] rounded-full" />
    </SkeletonGroup>
  )
}
