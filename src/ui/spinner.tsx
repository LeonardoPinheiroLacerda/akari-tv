interface SpinnerProps {
  /** Lado em rem (dp de design / 16). */
  sizeRem?: number
  label?: string
}

/**
 * Indicador de carregamento nas cores do Akari: arco laranja (`--color-brand`)
 * sobre um anel discreto. Gira só por `transform` (animação `spin` do
 * Tailwind), como pede a seção 7.
 */
export function Spinner({ sizeRem = 6, label = 'Carregando' }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 48 48"
      className="animate-spin"
      style={{ width: `${sizeRem}rem`, height: `${sizeRem}rem` }}
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="var(--color-surface-elevated)"
        strokeWidth="5"
      />
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="40 126"
      />
    </svg>
  )
}
