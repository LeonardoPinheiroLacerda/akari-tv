import { Play, type LucideIcon } from 'lucide-react'
import { Focusable } from './focusable'
import { Skeleton } from './skeleton'

export const PLAY_BUTTON_HEIGHT_REM = 4.5

interface PlayButtonProps {
  label?: string
  /** Ícone à esquerda do rótulo; só o de play é preenchido. */
  icon?: LucideIcon
  autoFocus?: boolean
  /** Chave de foco, para devolver o foco a este botão com `setFocus`. */
  focusKey?: string
  onPress?: () => void
  onFocus?: () => void
}

/**
 * Botão principal de reprodução. Mesma linguagem de foco da sidebar e das
 * abas: fundo laranja numa camada própria que entra por opacidade, scale no
 * contêiner — só opacity/transform animam (seção 7, APRENDIZADOS.md).
 */
export function PlayButton({
  label = 'Assistir',
  icon: Icon = Play,
  autoFocus,
  focusKey,
  onPress,
  onFocus,
}: PlayButtonProps) {
  const filled = Icon === Play
  return (
    <Focusable
      focusKey={focusKey}
      autoFocus={autoFocus}
      onEnterPress={onPress}
      onFocus={onFocus}
    >
      {(focused) => (
        <div
          role="button"
          className="relative inline-flex items-center gap-4 rounded-full px-8"
          style={{
            height: `${PLAY_BUTTON_HEIGHT_REM}rem`,
            transform: focused ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 120ms',
          }}
        >
          <div aria-hidden className="absolute inset-0 rounded-full bg-surface-elevated" />
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-brand"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          <Icon
            aria-hidden
            className="relative size-8"
            strokeWidth={filled ? undefined : 2.5}
            color={focused ? 'var(--color-bg)' : 'var(--color-text)'}
            fill={!filled ? 'none' : focused ? 'var(--color-bg)' : 'var(--color-text)'}
          />
          <span
            className="relative text-[2rem] font-medium"
            style={{ color: focused ? 'var(--color-bg)' : 'var(--color-text)' }}
          >
            {label}
          </span>
        </div>
      )}
    </Focusable>
  )
}

/** Botão de play carregando, na altura do real (dentro de um `SkeletonGroup`). */
export function PlayButtonSkeleton() {
  return <Skeleton className="w-[14rem] rounded-full" style={{ height: `${PLAY_BUTTON_HEIGHT_REM}rem` }} />
}
