import type { PlaybackDisplay, PlaybackItem } from '@/lib/navigation'
import { Backdrop } from '@/ui/anime-hero'
import { PlayButton } from '@/ui/play-button'

interface EndScreenProps {
  /** O que acabou de tocar. */
  display?: PlaybackDisplay
  /** O próximo da fila de origem; sem ele, só a volta para a lista. */
  next?: PlaybackItem
  onNext: () => void
  onBack: () => void
}

/**
 * Fim da reprodução, no padrão das telas de anime: backdrop do anime em tela
 * cheia com o degradê e o texto ancorado embaixo à esquerda. O foco começa no
 * botão principal — "Ver próximo episódio" quando há próximo na fila.
 */
export function EndScreen({ display, next, onNext, onBack }: EndScreenProps) {
  return (
    <div className="bg-bg fixed inset-0 z-30 flex flex-col justify-end gap-8 px-[6rem] py-[4.5rem]">
      <Backdrop src={next?.display.backdrop ?? display?.backdrop} />

      <div className="relative flex max-w-[56rem] flex-col gap-2">
        <p className="text-muted-foreground text-[1.75rem]">
          {display?.subtitle ? `${display.subtitle} · concluído` : 'Concluído'}
        </p>
        {next ? (
          <>
            <p className="text-muted-foreground text-[1.75rem]">A seguir</p>
            {next.display.subtitle && (
              <p className="text-[1.75rem]">{next.display.subtitle}</p>
            )}
            <h1 className="text-[3rem] leading-tight font-medium">
              {next.display.title}
            </h1>
          </>
        ) : (
          <h1 className="text-[3rem] leading-tight font-medium">
            {display?.title ?? 'Fim'}
          </h1>
        )}
      </div>

      <div className="relative">
        {next ? (
          <PlayButton label="Ver próximo episódio" autoFocus onPress={onNext} />
        ) : (
          <PlayButton label="Voltar aos episódios" autoFocus onPress={onBack} />
        )}
      </div>
    </div>
  )
}
