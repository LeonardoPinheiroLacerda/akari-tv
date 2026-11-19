import { ListVideo, SkipForward } from 'lucide-react'
import type { PlaybackDisplay, PlaybackItem } from '@/lib/navigation'
import { Backdrop } from '@/ui/anime-hero'
import { HudLogo, HudPill, HudScrim } from './hud'

interface EndScreenProps {
  /** O que acabou de tocar. */
  display?: PlaybackDisplay
  /** O próximo da fila de origem; sem ele, só a volta para a lista. */
  next?: PlaybackItem
  onNext: () => void
  onBack: () => void
}

/**
 * Fim da reprodução, na identidade do HUD do player: backdrop do anime com os
 * degradês em cima e embaixo, logo no canto superior esquerdo, o que vem a
 * seguir ancorado embaixo e as ações em pílulas. O foco começa em "Próximo
 * episódio" quando há próximo na fila.
 */
export function EndScreen({ display, next, onNext, onBack }: EndScreenProps) {
  const done = display?.logoCaption ?? display?.subtitle
  return (
    <div className="bg-bg fixed inset-0 z-30">
      <Backdrop src={next?.display.backdrop ?? display?.backdrop} />
      <HudScrim />
      <HudLogo
        display={display}
        caption={done ? `${done} · concluído` : 'Concluído'}
      />

      <div className="absolute inset-x-[6rem] bottom-[4.5rem] flex flex-col gap-8">
        <div className="flex max-w-[56rem] flex-col gap-1">
          {next ? (
            <>
              <p className="text-muted-foreground text-[1.75rem]">
                {next.display.subtitle
                  ? `A seguir · ${next.display.subtitle}`
                  : 'A seguir'}
              </p>
              <p className="text-[2.5rem] leading-tight font-medium">
                {next.display.title}
              </p>
            </>
          ) : (
            <>
              {/* Sem logo, o que terminou fica escrito aqui embaixo. */}
              <p className="text-muted-foreground text-[1.75rem]">
                {!display?.logo && display?.subtitle
                  ? `${display.subtitle} · concluído`
                  : 'Concluído'}
              </p>
              <p className="text-[2.5rem] leading-tight font-medium">
                {display?.title ?? 'Fim'}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-6">
          {next && (
            <HudPill
              label="Próximo episódio"
              icon={SkipForward}
              filled
              autoFocus
              onPress={onNext}
            />
          )}
          <HudPill
            label="Voltar aos episódios"
            icon={ListVideo}
            autoFocus={!next}
            onPress={onBack}
          />
        </div>
      </div>
    </div>
  )
}
