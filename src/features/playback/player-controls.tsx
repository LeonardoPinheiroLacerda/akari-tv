import { memo, type ReactNode } from 'react'
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import {
  Captions,
  ChevronsRight,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import type { Chapter } from '@/api/generated/akariAPI.schemas'
import { timeLabel } from '@/lib/format'
import type { PlaybackDisplay } from '@/lib/navigation'
import { Focusable } from '@/ui/focusable'

export const CONTROLS_FOCUS_KEY = 'PLAYER_CONTROLS'
export const PLAY_FOCUS_KEY = 'PLAYER_PLAY'
export const TRACKS_FOCUS_KEY = 'PLAYER_TRACKS_BUTTON'
const SEEKBAR_FOCUS_KEY = 'PLAYER_SEEKBAR'

interface ControlButtonProps {
  focusKey: string
  label: string
  large?: boolean
  onPress: () => void
  children: (color: string) => ReactNode
}

/**
 * Botão redondo de controle: ícone branco sobre um círculo translúcido. Em
 * foco, o círculo clareia — uma camada própria que entra por opacidade
 * (seção 7). Sem `scale` e sem contorno fino: a TV desenha a interface em
 * 1080p e amplia para o painel 4K, e curvas finas de alto contraste ganham
 * degraus nessa ampliação (a captura em 1080p sai lisa). O rótulo é só para
 * leitor de tela (`aria-label`).
 */
function ControlButton({
  focusKey,
  label,
  large,
  onPress,
  children,
}: ControlButtonProps) {
  const size = large ? '6rem' : '4.5rem'
  return (
    <Focusable focusKey={focusKey} onEnterPress={onPress}>
      {(focused) => (
        <div
          role="button"
          aria-label={label}
          className="relative flex items-center justify-center rounded-full"
          style={{ width: size, height: size }}
        >
          <div
            aria-hidden
            className="bg-text/10 absolute inset-0 rounded-full"
          />
          <div
            aria-hidden
            className="bg-text/55 absolute inset-0 rounded-full"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ opacity: focused ? 1 : 0.8, transition: 'opacity 120ms' }}
          >
            {children('var(--color-text)')}
          </div>
        </div>
      )}
    </Focusable>
  )
}

/**
 * Botão "Pular abertura": pílula com texto (a ação não tem ícone universal),
 * no mesmo estilo de foco dos botões redondos — fundo branco translúcido que
 * clareia por opacidade, sem scale (seção 7).
 */
function SkipIntroButton({ onPress }: { onPress: () => void }) {
  return (
    <Focusable focusKey="PLAYER_SKIP_INTRO" onEnterPress={onPress}>
      {(focused) => (
        <div
          role="button"
          className="relative flex h-[4.5rem] items-center gap-2 rounded-full pr-7 pl-6"
        >
          <div
            aria-hidden
            className="bg-text/10 absolute inset-0 rounded-full"
          />
          <div
            aria-hidden
            className="bg-text/55 absolute inset-0 rounded-full"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          <span className="relative text-[1.75rem] font-medium">
            Pular abertura
          </span>
          <ChevronsRight
            aria-hidden
            className="relative size-8"
            color="var(--color-text)"
            strokeWidth={2.5}
          />
        </div>
      )}
    </Focusable>
  )
}

/** Seta circular com o passo do seek no meio (estilo "voltar 10s"). */
function StepIcon({
  direction,
  seconds,
  color,
}: {
  direction: 'back' | 'forward'
  seconds: number
  color: string
}) {
  const Icon = direction === 'back' ? RotateCcw : RotateCw
  return (
    <span className="relative flex size-10 items-center justify-center">
      <Icon
        aria-hidden
        className="absolute size-10"
        color={color}
        strokeWidth={2.5}
      />
      <span className="relative text-[0.875rem] font-medium" style={{ color }}>
        {seconds}
      </span>
    </span>
  )
}

/**
 * Fileira de botões como região de foco própria: ◀ ▶ ficam entre os botões
 * (sem ela, sair do botão da direita caía na barra de progresso, que é larga
 * e "mais perto" geometricamente); ▲ sai da fileira para a barra.
 */
function ButtonRow({ children }: { children: ReactNode }) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'PLAYER_BUTTONS',
    saveLastFocusedChild: true,
    preferredChildFocusKey: PLAY_FOCUS_KEY,
  })
  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="grid grid-cols-[1fr_auto_1fr] items-center">
        {children}
      </div>
    </FocusContext.Provider>
  )
}

interface SeekBarProps {
  position: number
  duration?: number
  chapters: Chapter[]
  /**
   * Controles visíveis sem estarem ativos (carregando, pausado, seek pelas
   * setas): o foco do D-pad está no player e ◀ ▶ já avançam/voltam, então a
   * barra é desenhada como em foco — senão ela "tem o foco" sem parecer.
   */
  scrubbing: boolean
  onStep: (direction: 1 | -1) => void
}

/**
 * Segmentos da barra (início e fim em 0–1): um por trecho entre inícios de
 * capítulo, ou um só sem capítulos. Inícios no começo/fim da mídia ou
 * repetidos (capítulos sobrepostos, como "Intro" e "Abertura" no mesmo ponto)
 * não criam segmento vazio. É só desenho: os capítulos chegam do backend como
 * estão no arquivo.
 */
function segmentsFor(
  chapters: Chapter[],
  duration?: number,
): Array<[number, number]> {
  if (!duration) return [[0, 1]]
  const cuts = [
    ...new Set(
      chapters
        .map((chapter) => chapter.startSeconds)
        .filter((start) => start > 0.5 && start < duration - 0.5)
        .map((start) => Math.round((start / duration) * 1000) / 1000),
    ),
  ].sort((a, b) => a - b)
  const bounds = [0, ...cuts, 1]
  return bounds
    .slice(0, -1)
    .map((start, index) => [start, bounds[index + 1] ?? 1])
}

/** Capítulo em que a posição está: o que começou por último até ela. */
function currentChapter(
  chapters: Chapter[],
  position: number,
): Chapter | undefined {
  let current: Chapter | undefined
  for (const chapter of chapters) {
    if (
      chapter.startSeconds <= position + 0.25 &&
      position < chapter.endSeconds
    ) {
      if (!current || chapter.startSeconds >= current.startSeconds)
        current = chapter
    }
  }
  return current
}

function SeekBar({
  position,
  duration,
  chapters,
  scrubbing,
  onStep,
}: SeekBarProps) {
  const segments = segmentsFor(chapters, duration)
  const progress = duration ? Math.min(1, Math.max(0, position / duration)) : 0
  const { ref, focused } = useFocusable({
    focusKey: SEEKBAR_FOCUS_KEY,
    onArrowPress: (direction) => {
      if (direction === 'left') onStep(-1)
      else if (direction === 'right') onStep(1)
      else return true
      return false
    },
  })

  const highlighted = focused || scrubbing

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="relative flex h-8 flex-1 items-center"
    >
      {/* Um segmento arredondado por capítulo, separados por um vão (como no
          YouTube). Cada um tem a própria trilha e o próprio preenchimento,
          que cresce por scaleX (seção 7). */}
      <div
        className="flex h-2 w-full gap-[0.375rem]"
        style={{
          transform: highlighted ? 'scaleY(1.75)' : 'scaleY(1)',
          transition: 'transform 120ms',
        }}
      >
        {segments.map(([start, end]) => {
          const fill = Math.min(
            1,
            Math.max(0, (progress - start) / (end - start)),
          )
          return (
            <div
              key={start}
              className="bg-text/25 h-full overflow-hidden rounded-full"
              style={{ flexGrow: end - start, flexBasis: 0 }}
            >
              <div
                className="bg-brand h-full w-full origin-left"
                style={{
                  transform: `scaleX(${fill})`,
                  transition: 'transform 250ms linear',
                }}
              />
            </div>
          )
        })}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `translateX(${progress * 100}%)`,
          transition: 'transform 250ms linear',
        }}
      >
        {/* Montado só em foco, sem transição de opacidade: com a transição, a
            WebView às vezes não redesenhava o marcador no primeiro foco (ele
            ficava com opacidade 1 no DOM mas invisível até um novo foco). */}
        {highlighted && (
          <div className="bg-brand ring-text absolute top-1/2 left-0 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4" />
        )}
      </div>
    </div>
  )
}

interface PlayerControlsProps {
  display?: PlaybackDisplay
  position: number
  duration?: number
  chapters: Chapter[]
  paused: boolean
  /** Visível na tela (inclui o modo passivo, durante um seek pelas setas). */
  visible: boolean
  /** Recebe foco (o usuário está navegando pelos controles). */
  active: boolean
  stepSeconds: number
  onTogglePlay: () => void
  onStep: (direction: 1 | -1) => void
  onOpenTracks: () => void
  onSkipIntro: () => void
  /** Episódio anterior/próximo; sem eles, o botão não aparece. */
  onPrevious?: () => void
  onNext?: () => void
}

/**
 * Controles do player na base da tela: título, barra de progresso com tempos
 * e a fileira de botões — voltar, play/pause e avançar no centro; áudio e
 * legendas à direita. Inativa, a região sai da navegação espacial (as setas
 * voltam a ser atalhos de seek no player).
 */
export const PlayerControls = memo(function PlayerControls({
  display,
  position,
  duration,
  chapters,
  paused,
  visible,
  active,
  stepSeconds,
  onTogglePlay,
  onStep,
  onOpenTracks,
  onSkipIntro,
  onPrevious,
  onNext,
}: PlayerControlsProps) {
  const chapter = currentChapter(chapters, position)
  const { ref, focusKey } = useFocusable({
    focusKey: CONTROLS_FOCUS_KEY,
    focusable: active,
    preferredChildFocusKey: PLAY_FOCUS_KEY,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        aria-hidden={!visible}
        className="pointer-events-none absolute inset-0"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms' }}
      >
        <div className="from-bg via-bg/70 absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t to-transparent" />
        <div className="absolute inset-x-[6rem] bottom-[4.5rem] flex flex-col gap-6">
          <div className="flex items-end justify-between gap-8">
            <div className="flex flex-col gap-1">
              {display?.subtitle && (
                <p className="text-muted-foreground text-[1.75rem]">
                  {display.subtitle}
                </p>
              )}
              {display?.title && (
                <p className="text-[2.5rem] leading-tight font-medium">
                  {display.title}
                </p>
              )}
            </div>
            {chapter?.title && (
              <p className="text-muted-foreground shrink-0 text-[1.75rem]">
                {chapter.title}
              </p>
            )}
          </div>

          <div className="flex items-center gap-6 text-[1.75rem] tabular-nums">
            <span className="text-text w-[6rem]">{timeLabel(position)}</span>
            <SeekBar
              position={position}
              duration={duration}
              chapters={chapters}
              scrubbing={visible && !active}
              onStep={onStep}
            />
            <span className="text-muted-foreground w-[6rem] text-right">
              {duration ? timeLabel(duration) : ''}
            </span>
          </div>

          <ButtonRow>
            <div className="flex justify-start">
              <SkipIntroButton onPress={onSkipIntro} />
            </div>
            <div className="flex items-center gap-8">
              {onPrevious && (
                <ControlButton
                  focusKey="PLAYER_PREVIOUS"
                  label="Episódio anterior"
                  onPress={onPrevious}
                >
                  {(color) => (
                    <SkipBack
                      aria-hidden
                      className="size-8"
                      color={color}
                      fill={color}
                      strokeWidth={2.5}
                    />
                  )}
                </ControlButton>
              )}
              <ControlButton
                focusKey="PLAYER_BACK"
                label={`Voltar ${stepSeconds}s`}
                onPress={() => onStep(-1)}
              >
                {(color) => (
                  <StepIcon
                    direction="back"
                    seconds={stepSeconds}
                    color={color}
                  />
                )}
              </ControlButton>
              <ControlButton
                focusKey={PLAY_FOCUS_KEY}
                label={paused ? 'Reproduzir' : 'Pausar'}
                large
                onPress={onTogglePlay}
              >
                {(color) =>
                  paused ? (
                    <Play
                      aria-hidden
                      className="ml-1 size-11"
                      color={color}
                      fill={color}
                    />
                  ) : (
                    <Pause
                      aria-hidden
                      className="size-11"
                      color={color}
                      fill={color}
                    />
                  )
                }
              </ControlButton>
              <ControlButton
                focusKey="PLAYER_FORWARD"
                label={`Avançar ${stepSeconds}s`}
                onPress={() => onStep(1)}
              >
                {(color) => (
                  <StepIcon
                    direction="forward"
                    seconds={stepSeconds}
                    color={color}
                  />
                )}
              </ControlButton>
              {onNext && (
                <ControlButton
                  focusKey="PLAYER_NEXT"
                  label="Próximo episódio"
                  onPress={onNext}
                >
                  {(color) => (
                    <SkipForward
                      aria-hidden
                      className="size-8"
                      color={color}
                      fill={color}
                      strokeWidth={2.5}
                    />
                  )}
                </ControlButton>
              )}
            </div>
            <div className="flex justify-end">
              <ControlButton
                focusKey={TRACKS_FOCUS_KEY}
                label="Áudio e legendas"
                onPress={onOpenTracks}
              >
                {(color) => (
                  <Captions
                    aria-hidden
                    className="size-9"
                    color={color}
                    strokeWidth={2.5}
                  />
                )}
              </ControlButton>
            </div>
          </ButtonRow>
        </div>
      </div>
    </FocusContext.Provider>
  )
})
