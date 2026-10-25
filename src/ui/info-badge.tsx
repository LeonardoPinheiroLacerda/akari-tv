import type { LucideIcon } from 'lucide-react'

interface InfoBadgeProps {
  icon: LucideIcon
  label: string
  /** Cor do ícone (token CSS); o texto fica sempre na cor de texto. */
  iconColor?: string
  /** Ícone preenchido (ex.: estrela da nota). */
  filled?: boolean
}

/**
 * Pílula de informação (ícone + rótulo) para metadados sobre imagem. Fundo
 * escuro translúcido e borda sutil dão leitura sobre o banner sem
 * `backdrop-filter` (seção 7); a cor fica só no ícone.
 */
export function InfoBadge({ icon: Icon, label, iconColor, filled }: InfoBadgeProps) {
  const color = iconColor ?? 'var(--color-text-muted)'
  return (
    <span className="inline-flex h-12 items-center gap-2.5 rounded-full border border-border bg-bg/70 px-4 text-[1.75rem] leading-none whitespace-nowrap">
      <Icon aria-hidden className="size-6 shrink-0" color={color} fill={filled ? color : 'none'} />
      {label}
    </span>
  )
}
