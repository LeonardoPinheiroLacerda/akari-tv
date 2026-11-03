import { useEffect } from 'react'
import {
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation'
import type { MediaInfoResponse } from '@/api/generated/akariAPI.schemas'
import { bitrateLabel, codecLabel, sizeLabel, timeLabel } from '@/lib/format'
import { remToPx } from '@/lib/layout'
import { smoothScrollBy } from '@/lib/scroll'

export const NERD_DETAILS_FOCUS_KEY = 'PLAYER_NERD_DETAILS'
// Quanto cada seta rola a lista (dp de design / 16).
const SCROLL_STEP_REM = 8

// Formatos de legenda que o backend entrega como faixa selecionável (WebVTT);
// os demais são queimados no vídeo (contrato: `subtitleTrackIndex`).
const SOFT_SUBTITLE_CODECS = new Set(['subrip', 'srt'])
const BITMAP_SUBTITLE_CODECS = new Set([
  'hdmv_pgs_subtitle',
  'dvd_subtitle',
  'dvb_subtitle',
])

type Field = [
  label: string,
  value: string | number | boolean | null | undefined,
]

function fmtNumber(value: number, fractionDigits = 3): string {
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: fractionDigits,
  })
}

function yesNo(value?: boolean | null): string | undefined {
  if (value == null) return undefined
  return value ? 'sim' : 'não'
}

/** Profundidade de cor a partir do formato de pixel (`yuv420p10le` → 10). */
function bitDepth(pixFmt?: string | null): number | undefined {
  if (!pixFmt) return undefined
  const match = pixFmt.match(/p(\d{2})(le|be)?$/)
  return match ? Number(match[1]) : 8
}

function Block({ title, fields }: { title: string; fields: Field[] }) {
  const shown = fields.filter(([, value]) => value != null && value !== '')
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-brand text-[1.75rem] font-medium">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 font-mono text-[1.75rem] leading-snug">
        {shown.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

interface NerdDetailsProps {
  probe: MediaInfoResponse
  /** OK fecha os detalhes (o mesmo toggle que os abriu). */
  onClose: () => void
}

/**
 * "Detalhes para nerds": o mediaprobe inteiro, stream por stream, em texto
 * técnico (nomes crus do ffprobe ao lado dos de exibição). É uma região
 * focável que fica com o foco enquanto aberta: ▲ ▼ rolam e OK fecha — o mesmo
 * toggle que a abriu. As setas não saem dela.
 */
export function NerdDetails({ probe, onClose }: NerdDetailsProps) {
  const { ref } = useFocusable<unknown, HTMLDivElement>({
    focusKey: NERD_DETAILS_FOCUS_KEY,
    onEnterPress: onClose,
    onArrowPress: (direction) => {
      const element = ref.current
      if (element && (direction === 'down' || direction === 'up')) {
        const step = remToPx(SCROLL_STEP_REM)
        smoothScrollBy(element, { top: direction === 'down' ? step : -step })
      }
      return false
    },
  })

  useEffect(() => {
    setFocus(NERD_DETAILS_FOCUS_KEY)
  }, [])

  const { container } = probe

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="bg-text/5 flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-6 overflow-y-auto rounded-xl px-5 py-4"
    >
      <Block
        title="Container"
        fields={[
          ['format', container.formatName],
          ['nome', container.formatLongName],
          [
            'duração',
            container.durationSeconds != null &&
              `${fmtNumber(container.durationSeconds)} s`,
          ],
          [
            'tamanho',
            container.sizeBytes != null &&
              `${sizeLabel(container.sizeBytes)} (${container.sizeBytes.toLocaleString('pt-BR')} B)`,
          ],
          [
            'bitrate',
            container.bitRate != null && bitrateLabel(container.bitRate),
          ],
          [
            'streams',
            `${probe.video.length} vídeo · ${probe.audio.length} áudio · ${probe.subtitles.length} legenda`,
          ],
        ].map(([label, value]) => [label, value || undefined] as Field)}
      />

      {probe.chapters.length > 0 && (
        <Block
          title={`Capítulos (${probe.chapters.length})`}
          fields={probe.chapters.map(
            (chapter, index) =>
              [
                `${index}`,
                `${timeLabel(chapter.startSeconds)}–${timeLabel(chapter.endSeconds)}${
                  chapter.title ? ` ${chapter.title}` : ''
                }`,
              ] as Field,
          )}
        />
      )}

      {probe.video.map((track, index) => (
        <Block
          key={`v${index}`}
          title={`Vídeo #${track.index ?? index}`}
          fields={[
            [
              'codec',
              [codecLabel(track.codec), track.codec && `(${track.codec})`]
                .filter(Boolean)
                .join(' '),
            ],
            ['profile', track.profile],
            [
              'resolução',
              track.width && track.height
                ? `${track.width}×${track.height}`
                : undefined,
            ],
            ['DAR', track.displayAspectRatio],
            ['SAR', track.sampleAspectRatio],
            [
              'anamórfico',
              track.sampleAspectRatio
                ? yesNo(track.sampleAspectRatio !== '1:1')
                : undefined,
            ],
            [
              'fps',
              track.frameRate != null ? fmtNumber(track.frameRate) : undefined,
            ],
            ['pix_fmt', track.pixFmt],
            ['bits', bitDepth(track.pixFmt)],
            [
              'bitrate',
              track.bitRate != null ? bitrateLabel(track.bitRate) : undefined,
            ],
            ['idioma', track.language],
            ['título', track.title],
            ['padrão', yesNo(track.defaultTrack)],
          ]}
        />
      ))}

      {probe.audio.map((track, index) => (
        <Block
          key={`a${index}`}
          title={`Áudio ${index} · stream #${track.index ?? '?'}`}
          fields={[
            [
              'codec',
              [codecLabel(track.codec), track.codec && `(${track.codec})`]
                .filter(Boolean)
                .join(' '),
            ],
            ['canais', track.channels],
            ['layout', track.channelLayout],
            [
              'amostragem',
              track.sampleRate != null
                ? `${track.sampleRate.toLocaleString('pt-BR')} Hz`
                : undefined,
            ],
            [
              'bitrate',
              track.bitRate != null ? bitrateLabel(track.bitRate) : undefined,
            ],
            ['idioma', track.language],
            ['título', track.title],
            ['padrão', yesNo(track.defaultTrack)],
          ]}
        />
      ))}

      {probe.subtitles.map((track, index) => {
        const codec = track.codec?.toLowerCase() ?? ''
        const kind = BITMAP_SUBTITLE_CODECS.has(codec) ? 'imagem' : 'texto'
        const delivery = SOFT_SUBTITLE_CODECS.has(codec)
          ? 'selecionável (WebVTT)'
          : 'queimada no vídeo'
        return (
          <Block
            key={`s${index}`}
            title={`Legenda ${index} · stream #${track.index ?? '?'}`}
            fields={[
              [
                'codec',
                [codecLabel(track.codec), track.codec && `(${track.codec})`]
                  .filter(Boolean)
                  .join(' '),
              ],
              ['tipo', kind],
              ['entrega', delivery],
              ['idioma', track.language],
              ['título', track.title],
              ['forçada', yesNo(track.forced)],
              ['padrão', yesNo(track.defaultTrack)],
            ]}
          />
        )
      })}
    </div>
  )
}
