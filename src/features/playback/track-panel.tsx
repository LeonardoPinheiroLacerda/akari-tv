import { memo, useCallback, useEffect, useState } from 'react'
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import { Check, Glasses } from 'lucide-react'
import type {
  AudioTrack,
  MediaInfoResponse,
  SubtitleTrack,
} from '@/api/generated/akariAPI.schemas'
import { codecLabel, languageLabel } from '@/lib/format'
import { remToPx } from '@/lib/layout'
import { scrollTarget, smoothScrollTo } from '@/lib/scroll'
import { Focusable } from '@/ui/focusable'
import { NerdDetails } from './nerd-details'
import type { TrackSelection } from './use-playback-session'

const PANEL_FOCUS_KEY = 'PLAYER_TRACKS'

function trackKey(kind: 'audio' | 'subtitle', index: number | null): string {
  return `PLAYER_TRACK_${kind}_${index ?? 'off'}`
}

const INFO_FOCUS_KEY = 'PLAYER_TRACK_INFO'
// Folga mantida acima e abaixo da opção em foco ao rolar o painel.
const SCROLL_MARGIN_REM = 6

/** Layout de canais do ffprobe em notação curta: `stereo` → "2.0", `5.1(side)` → "5.1". */
function channelsLabel(track: AudioTrack): string | undefined {
  const layout = track.channelLayout?.toLowerCase()
  if (layout === 'stereo') return '2.0'
  if (layout === 'mono') return '1.0'
  const match = layout?.match(/^(\d+\.\d+)/)
  if (match) return match[1]
  return track.channels ? `${track.channels} canais` : undefined
}

function audioBadges(track: AudioTrack): string[] {
  return [codecLabel(track.codec), channelsLabel(track)].filter(
    (badge): badge is string => Boolean(badge),
  )
}

function subtitleBadges(track: SubtitleTrack): string[] {
  const codec = codecLabel(track.codec)
  return codec ? [codec] : []
}

// Títulos comuns de faixa, no padrão dos rips de streaming: `<variante>`,
// `<tipo>` ou `<variante> (<tipo>)`. A variante do idioma (região, escrita)
// vai junto do nome; o tipo, no detalhe. O que não estiver aqui aparece como
// veio do arquivo.
const TITLE_VARIANTS: Record<string, string> = {
  'latin american': 'América Latina',
  european: 'Europa',
  castilian: 'Espanha',
  brazilian: 'Brasil',
  canadian: 'Canadá',
  traditional: 'Tradicional',
  simplified: 'Simplificado',
  // Idioma escrito em alfabeto latino (ex.: hindi romanizado).
  latin: 'Romanizado',
  cantonese: 'Cantonês',
  mandarin: 'Mandarim',
}

const FORCED_KIND = 'Forçada'
const HEARING_IMPAIRED_KIND = 'Para surdos (SDH)'

const TITLE_KINDS: Record<string, string> = {
  forced: FORCED_KIND,
  sdh: HEARING_IMPAIRED_KIND,
  cc: 'Para surdos (CC)',
  // Legenda que transcreve o áudio dublado, não o original.
  dubtitle: 'Transcrição da dublagem',
  commentary: 'Comentários',
  'audio description': 'Audiodescrição',
  descriptive: 'Audiodescrição',
}

interface TitleParts {
  variant?: string
  /** Tipos reconhecidos e trechos desconhecidos, na ordem do título. */
  details: string[]
}

/** "Latin American (Forced)" → variante "América Latina", detalhe "Forçada". */
function parseTitle(title?: string | null): TitleParts {
  const parts: TitleParts = { details: [] }
  if (!title) return parts
  const match = title.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
  const pieces = match ? [match[1] ?? '', match[2] ?? ''] : [title]
  for (const piece of pieces) {
    const text = piece.trim()
    const key = text.toLowerCase()
    if (!text) continue
    const variant = TITLE_VARIANTS[key]
    if (variant && !parts.variant) parts.variant = variant
    else parts.details.push(TITLE_KINDS[key] ?? text)
  }
  return parts
}

/** Idioma, com a variante do título quando houver: "Espanhol (América Latina)". */
function trackLabel(track: AudioTrack | SubtitleTrack): string {
  const language = languageLabel(track.language)
  const { variant } = parseTitle(track.title)
  return variant ? `${language} (${variant})` : language
}

function joinDetails(details: (string | false | null | undefined)[]) {
  const unique = [...new Set(details.filter(Boolean))]
  return unique.length > 0 ? unique.join(' · ') : undefined
}

function audioDetail(track: AudioTrack): string | undefined {
  return joinDetails(parseTitle(track.title).details)
}

function subtitleDetail(track: SubtitleTrack): string | undefined {
  return joinDetails([
    track.forced && FORCED_KIND,
    track.hearingImpaired && HEARING_IMPAIRED_KIND,
    ...parseTitle(track.title).details,
  ])
}

/** Badge discreto de metadado técnico (codec, canais). */
function TechBadge({ label }: { label: string }) {
  return (
    <span className="bg-text/10 text-muted-foreground shrink-0 rounded-md px-2 text-[1.75rem] leading-snug">
      {label}
    </span>
  )
}

interface TrackOptionProps {
  focusKey: string
  label: string
  badges?: string[]
  detail?: string
  selected: boolean
  onSelect: () => void
  onFocused: (node: HTMLElement) => void
}

/**
 * Opção de faixa. Foco no mesmo estilo dos botões do player: fundo branco
 * translúcido numa camada própria, por opacidade (seção 7), com o texto
 * sempre claro. O laranja fica só no ✓ da faixa escolhida.
 */
function TrackOption({
  focusKey,
  label,
  badges = [],
  detail,
  selected,
  onSelect,
  onFocused,
}: TrackOptionProps) {
  return (
    <Focusable
      focusKey={focusKey}
      onEnterPress={onSelect}
      onFocus={(layout) => onFocused(layout.node)}
    >
      {(focused) => (
        <div className="relative flex items-center gap-4 rounded-xl px-5 py-3">
          <div
            aria-hidden
            className="bg-text/20 absolute inset-0 rounded-xl"
            style={{ opacity: focused ? 1 : 0, transition: 'opacity 120ms' }}
          />
          <Check
            aria-hidden
            className="relative size-7 shrink-0"
            style={{ opacity: selected ? 1 : 0 }}
            color="var(--color-brand)"
          />
          <div className="relative min-w-0">
            <div className="flex items-center gap-3">
              <p
                className="text-[1.75rem] leading-tight font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                {label}
              </p>
              {badges.map((badge) => (
                <TechBadge key={badge} label={badge} />
              ))}
            </div>
            {detail && (
              <p
                className="truncate text-[1.75rem] leading-tight"
                style={{
                  color: focused
                    ? 'var(--color-text)'
                    : 'var(--color-text-muted)',
                }}
              >
                {detail}
              </p>
            )}
          </div>
        </div>
      )}
    </Focusable>
  )
}

/** Botão "Detalhes para nerds", no mesmo estilo de foco dos controles do player. */
function NerdButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  return (
    <Focusable focusKey={INFO_FOCUS_KEY} onEnterPress={onPress}>
      {(focused) => (
        <div
          role="button"
          aria-label={
            open ? 'Ocultar detalhes para nerds' : 'Detalhes para nerds'
          }
          aria-expanded={open}
          className="relative flex size-14 items-center justify-center rounded-full"
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
          <Glasses
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

interface TrackPanelProps {
  probe: MediaInfoResponse
  selection: TrackSelection
  onSelect: (selection: TrackSelection) => void
}

/**
 * Painel lateral de áudio e legenda (seção 6: painel prende o foco). Abre com o
 * foco na faixa de áudio atual; quem abre cuida de fechá-lo com Voltar. Cada
 * faixa mostra o codec em badge; o ícone de óculos no topo troca a lista pelos
 * "detalhes para nerds" (o mediaprobe completo) e de volta.
 */
export const TrackPanel = memo(function TrackPanel({
  probe,
  selection,
  onSelect,
}: TrackPanelProps) {
  const { audio, subtitles } = probe
  const [nerdOpen, setNerdOpen] = useState(false)
  const toggleNerd = () => {
    if (nerdOpen) setFocus(INFO_FOCUS_KEY)
    setNerdOpen((open) => !open)
  }
  const { ref, focusKey } = useFocusable<unknown, HTMLElement>({
    focusKey: PANEL_FOCUS_KEY,
    isFocusBoundary: true,
  })

  // A lista pode passar da altura da tela (ex.: 5 áudios e 14 legendas) e o
  // foco do D-pad não rola nada sozinho (`preventScroll`): o painel rola para
  // manter a opção em foco visível, com folga em cima e embaixo.
  const followFocus = useCallback(
    (node: HTMLElement) => {
      const panel = ref.current
      if (!panel) return
      const margin = remToPx(SCROLL_MARGIN_REM)
      const top = node.offsetTop - margin
      const bottom = node.offsetTop + node.offsetHeight + margin
      const current = scrollTarget(panel).top
      if (top < current) {
        smoothScrollTo(panel, { top })
      } else if (bottom > current + panel.clientHeight) {
        smoothScrollTo(panel, { top: bottom - panel.clientHeight })
      }
    },
    [ref],
  )

  // Só ao abrir: depois o foco é do usuário.
  const [openingAudio] = useState(selection.audio)
  useEffect(() => {
    setFocus(trackKey('audio', openingAudio))
  }, [openingAudio])

  return (
    <FocusContext.Provider value={focusKey}>
      <aside
        ref={ref}
        aria-label="Áudio e legendas"
        className="bg-surface absolute inset-y-0 right-0 flex w-[38rem] [scrollbar-width:none] flex-col gap-8 overflow-y-auto px-6 py-[3.375rem]"
      >
        <header className="flex items-center justify-between pl-5">
          <h2 className="text-[2rem] font-medium">
            {nerdOpen ? 'Detalhes para nerds' : 'Áudio e legendas'}
          </h2>
          <NerdButton open={nerdOpen} onPress={toggleNerd} />
        </header>

        {nerdOpen && <NerdDetails probe={probe} onClose={toggleNerd} />}
        {!nerdOpen && (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="text-muted-foreground px-5 text-[1.75rem]">
                Áudio
              </h2>
              {audio.map((track, index) => (
                <TrackOption
                  key={trackKey('audio', index)}
                  focusKey={trackKey('audio', index)}
                  label={trackLabel(track)}
                  badges={audioBadges(track)}
                  detail={audioDetail(track)}
                  selected={selection.audio === index}
                  onFocused={followFocus}
                  onSelect={() => onSelect({ ...selection, audio: index })}
                />
              ))}
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-muted-foreground px-5 text-[1.75rem]">
                Legenda
              </h2>
              <TrackOption
                focusKey={trackKey('subtitle', null)}
                label="Desligada"
                selected={selection.subtitle === null}
                onFocused={followFocus}
                onSelect={() => onSelect({ ...selection, subtitle: null })}
              />
              {subtitles.map((track, index) => (
                <TrackOption
                  key={trackKey('subtitle', index)}
                  focusKey={trackKey('subtitle', index)}
                  label={trackLabel(track)}
                  badges={subtitleBadges(track)}
                  detail={subtitleDetail(track)}
                  selected={selection.subtitle === index}
                  onFocused={followFocus}
                  onSelect={() => onSelect({ ...selection, subtitle: index })}
                />
              ))}
            </section>
          </>
        )}
      </aside>
    </FocusContext.Provider>
  )
})
