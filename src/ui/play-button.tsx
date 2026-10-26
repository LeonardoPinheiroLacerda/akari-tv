import { Play } from 'lucide-react'
import { Focusable } from './focusable'

export const PLAY_BUTTON_HEIGHT_REM = 4.5

interface PlayButtonProps {
  label?: string
  autoFocus?: boolean
  onPress?: () => void
}

/**
 * Botão principal de reprodução. Mesma linguagem de foco da sidebar e das
 * abas: fundo laranja numa camada própria que entra por opacidade, scale no
 * contêiner — só opacity/transform animam (seção 7, APRENDIZADOS.md).
 */
export function PlayButton({ label = 'Assistir', autoFocus, onPress }: PlayButtonProps) {
  return (
    <Focusable autoFocus={autoFocus} onEnterPress={onPress}>
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
          <Play
            aria-hidden
            className="relative size-8"
            color={focused ? 'var(--color-bg)' : 'var(--color-text)'}
            fill={focused ? 'var(--color-bg)' : 'var(--color-text)'}
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
