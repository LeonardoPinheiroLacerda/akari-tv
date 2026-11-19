import type { LucideIcon } from 'lucide-react'
import type { PlaybackDisplay } from '@/lib/navigation'
import { Focusable } from '@/ui/focusable'

/**
 * Peças visuais do HUD do player, compartilhadas com as telas em volta dele
 * (preparo do arquivo, fim do episódio) para todas falarem a mesma língua:
 * degradês escuros em cima e embaixo, logo do anime no canto superior
 * esquerdo, texto ancorado embaixo e pílulas brancas translúcidas.
 */

/** Degradês do HUD: embaixo sempre, em cima quando há algo no topo. */
export function HudScrim({ top = true }: { top?: boolean }) {
  return (
    <>
      <div className="from-bg via-bg/70 pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t to-transparent" />
      {top && (
        <div className="from-bg via-bg/70 pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b to-transparent" />
      )}
    </>
  )
}

/**
 * Logo do anime no canto superior esquerdo, com uma linha embaixo (o
 * episódio, sem o nome do anime que o logo já mostra). Sem logo, nada — quem
 * usa mostra o título escrito.
 */
export function HudLogo({
  display,
  caption = display?.logoCaption,
}: {
  display?: PlaybackDisplay
  caption?: string
}) {
  if (!display?.logo) return null
  return (
    <div className="absolute top-[4.5rem] left-[6rem] flex flex-col gap-3">
      <img
        src={display.logo}
        alt={display.title}
        className="h-[7rem] w-[26rem] object-contain object-left"
      />
      {caption && (
        <p className="text-muted-foreground text-[1.75rem]">{caption}</p>
      )}
    </div>
  )
}

interface HudPillViewProps {
  label: string
  icon: LucideIcon
  /** Ícones de mídia (play, avançar) vão preenchidos, como nos botões redondos. */
  filled?: boolean
  highlighted: boolean
}

/**
 * Pílula do HUD: ícone e texto brancos sobre fundo branco translúcido que
 * clareia por opacidade em foco — o estilo dos botões redondos do player, sem
 * scale nem contorno fino (seção 7).
 */
export function HudPillView({
  label,
  icon: Icon,
  filled = false,
  highlighted,
}: HudPillViewProps) {
  const color = 'var(--color-text)'
  return (
    <div
      role="button"
      className="relative flex h-[5rem] items-center gap-4 rounded-full pr-9 pl-8"
    >
      <div aria-hidden className="bg-text/10 absolute inset-0 rounded-full" />
      <div
        aria-hidden
        className="bg-text/55 absolute inset-0 rounded-full"
        style={{ opacity: highlighted ? 1 : 0, transition: 'opacity 120ms' }}
      />
      <Icon
        aria-hidden
        className="relative size-8"
        color={color}
        fill={filled ? color : 'none'}
        strokeWidth={2.5}
      />
      <span className="relative text-[2rem] font-medium">{label}</span>
    </div>
  )
}

interface HudPillProps extends Omit<HudPillViewProps, 'highlighted'> {
  focusKey?: string
  autoFocus?: boolean
  /** Desenha em foco mesmo sem ter o foco (o OK de outro lugar aciona a pílula). */
  highlighted?: boolean
  onPress: () => void
}

/** Pílula focável do HUD. */
export function HudPill({
  focusKey,
  autoFocus,
  highlighted = false,
  onPress,
  ...view
}: HudPillProps) {
  return (
    <Focusable focusKey={focusKey} autoFocus={autoFocus} onEnterPress={onPress}>
      {(focused) => (
        <HudPillView {...view} highlighted={focused || highlighted} />
      )}
    </Focusable>
  )
}
