import { RotateCcw } from 'lucide-react'
import { timeLabel } from '@/lib/format'
import type { PlaybackDisplay } from '@/lib/navigation'
import { Dialog } from '@/ui/dialog'
import { PlayButton } from '@/ui/play-button'

interface ResumeDialogProps {
  display: PlaybackDisplay
  /** Onde o perfil parou, em segundos a partir do início da mídia. */
  positionSeconds: number
  onResume: () => void
  onRestart: () => void
  /** Voltar fecha sem reproduzir; quem abriu devolve o foco. */
  onClose: () => void
}

/**
 * Pergunta, ao abrir um arquivo que o perfil começou a ver, se continua de
 * onde parou ou começa do início, com "Continuar" já focado.
 */
export function ResumeDialog({
  display,
  positionSeconds,
  onResume,
  onRestart,
  onClose,
}: ResumeDialogProps) {
  return (
    <Dialog
      label="Continuar assistindo?"
      focusKey="RESUME_DIALOG"
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        {display.subtitle && (
          <p className="text-muted-foreground text-[1.75rem]">
            {display.subtitle}
          </p>
        )}
        <h2 className="text-[2.5rem] leading-tight font-medium">
          {display.title}
        </h2>
      </div>
      <p className="text-[2rem]">
        Você parou em{' '}
        <span className="text-brand tabular-nums">
          {timeLabel(positionSeconds)}
        </span>
        . Quer continuar de onde parou?
      </p>
      <div className="flex gap-4">
        <PlayButton
          label={`Continuar de ${timeLabel(positionSeconds)}`}
          autoFocus
          onPress={onResume}
        />
        <PlayButton
          label="Começar do início"
          icon={RotateCcw}
          onPress={onRestart}
        />
      </div>
    </Dialog>
  )
}
