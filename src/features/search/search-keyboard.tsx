import { memo, useCallback } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { Delete, Space, X, type LucideIcon } from 'lucide-react'
import { Focusable } from '@/ui/focusable'

/** Teclas especiais: qualquer valor com mais de um caractere não é digitado. */
export const KEY_BACKSPACE = 'backspace'
export const KEY_CLEAR = 'clear'
export const KEY_SPACE = ' '

const CHARACTERS = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('')
const COLUMNS = 6
const KEY_SIZE_REM = 4.5
const GAP_REM = 0.5
// Teclas de ação ocupam duas colunas da grade.
const WIDE_KEY_REM = KEY_SIZE_REM * 2 + GAP_REM

export const KEYBOARD_WIDTH_REM =
  KEY_SIZE_REM * COLUMNS + GAP_REM * (COLUMNS - 1)

const ACTIONS = [
  { value: KEY_SPACE, label: 'Espaço', icon: Space },
  { value: KEY_BACKSPACE, label: 'Apagar', icon: Delete },
  { value: KEY_CLEAR, label: 'Limpar', icon: X },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  icon: LucideIcon
}>

interface KeyProps {
  value: string
  label: string
  icon?: LucideIcon
  widthRem: number
  autoFocus?: boolean
  onPress: (value: string) => void
}

/**
 * Tecla do teclado na tela. Foco como pílula laranja numa camada própria, como
 * a sidebar: só opacity/transform animam, a cor do texto troca na hora.
 */
const Key = memo(function Key({
  value,
  label,
  icon: Icon,
  widthRem,
  autoFocus,
  onPress,
}: KeyProps) {
  const handleEnterPress = useCallback(() => onPress(value), [onPress, value])

  return (
    <Focusable autoFocus={autoFocus} onEnterPress={handleEnterPress}>
      {(focused) => (
        <div
          aria-label={label}
          className="bg-surface relative flex items-center justify-center gap-2 rounded-xl"
          style={{
            width: `${widthRem}rem`,
            height: `${KEY_SIZE_REM}rem`,
            transform: focused ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 120ms',
          }}
        >
          <div
            aria-hidden
            className="bg-brand absolute inset-0 rounded-xl"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          {Icon && (
            <Icon
              aria-hidden
              className="relative size-7"
              strokeWidth={2.25}
              color={focused ? 'var(--color-bg)' : 'var(--color-text-muted)'}
            />
          )}
          <span
            className="relative text-[1.75rem] leading-none font-medium"
            style={{
              color: focused ? 'var(--color-bg)' : 'var(--color-text)',
            }}
          >
            {label}
          </span>
        </div>
      )}
    </Focusable>
  )
})

interface SearchKeyboardProps {
  autoFocus: boolean
  /** Estável: recebe o caractere digitado ou uma das teclas especiais. */
  onPress: (value: string) => void
}

/**
 * Teclado alfanumérico na tela, em grade de 6 colunas, com Espaço, Apagar e
 * Limpar embaixo. Região própria de navegação, que guarda a última tecla
 * focada para o foco voltar a ela vindo dos resultados.
 */
export const SearchKeyboard = memo(function SearchKeyboard({
  autoFocus,
  onPress,
}: SearchKeyboardProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'SEARCH_KEYBOARD',
    saveLastFocusedChild: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="flex flex-col"
        style={{ gap: `${GAP_REM}rem`, width: `${KEYBOARD_WIDTH_REM}rem` }}
      >
        <div
          className="grid"
          style={{
            gap: `${GAP_REM}rem`,
            gridTemplateColumns: `repeat(${COLUMNS}, ${KEY_SIZE_REM}rem)`,
          }}
        >
          {CHARACTERS.map((character, index) => (
            <Key
              key={character}
              value={character}
              label={character}
              widthRem={KEY_SIZE_REM}
              autoFocus={autoFocus && index === 0}
              onPress={onPress}
            />
          ))}
        </div>
        <div className="flex" style={{ gap: `${GAP_REM}rem` }}>
          {ACTIONS.map((action) => (
            <Key
              key={action.value}
              value={action.value}
              label={action.label}
              icon={action.icon}
              widthRem={WIDE_KEY_REM}
              onPress={onPress}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  )
})
