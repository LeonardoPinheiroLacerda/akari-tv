// Formatação de exibição (seção 1 da especificação): rótulos e texto sem HTML,
// sem regra de negócio sobre os dados da API.

const FORMAT_LABELS: Record<string, string> = {
  TV: 'Série',
  TV_SHORT: 'Série curta',
  MOVIE: 'Filme',
  SPECIAL: 'Especial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Clipe',
}

export function formatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format
}

// Estações de estreia na convenção do AniList (calendário japonês), não as
// do hemisfério sul: "Primavera" de 1998 é abril–junho de 1998.
const SEASON_LABELS: Record<string, string> = {
  WINTER: 'Inverno',
  SPRING: 'Primavera',
  SUMMER: 'Verão',
  FALL: 'Outono',
}

export function seasonLabel(season: string): string {
  return SEASON_LABELS[season] ?? season
}

export function episodesLabel(episodes: number): string {
  return episodes === 1 ? '1 episódio' : `${episodes} episódios`
}

export function scoreLabel(score: number): string {
  return score.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** Texto puro a partir da sinopse em HTML da API (quebras viram espaço). */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Data ISO-8601 (`2004-10-05`) como "5 de out. de 2004", sem deslocar o dia por fuso. */
export function dateLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Velocidade de transferência em bytes/s como "12,3 MB/s". */
export function speedLabel(bytesPerSecond: number): string {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let value = bytesPerSecond
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[unit]}`
}

/** Tempo restante em segundos como "2 min" ou "45 s". */
export function remainingLabel(seconds: number): string {
  return seconds >= 60
    ? `${Math.round(seconds / 60)} min`
    : `${Math.max(0, Math.round(seconds))} s`
}

/** Posição de mídia em segundos como "4:05" ou "1:02:09". */
export function timeLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

const LANGUAGE_LABELS: Record<string, string> = {
  por: 'Português',
  pt: 'Português',
  jpn: 'Japonês',
  ja: 'Japonês',
  eng: 'Inglês',
  en: 'Inglês',
  spa: 'Espanhol',
  es: 'Espanhol',
  fre: 'Francês',
  fra: 'Francês',
  fr: 'Francês',
  ger: 'Alemão',
  deu: 'Alemão',
  de: 'Alemão',
  ita: 'Italiano',
  it: 'Italiano',
  kor: 'Coreano',
  ko: 'Coreano',
  chi: 'Chinês',
  zho: 'Chinês',
  zh: 'Chinês',
  rus: 'Russo',
  ru: 'Russo',
  ara: 'Árabe',
  ar: 'Árabe',
}

/** Nome do idioma de uma faixa a partir do código ISO 639 (`por` → "Português"). */
export function languageLabel(code?: string | null): string {
  if (!code) return 'Idioma desconhecido'
  return LANGUAGE_LABELS[code.toLowerCase()] ?? code.toUpperCase()
}

const CODEC_LABELS: Record<string, string> = {
  h264: 'H.264',
  hevc: 'HEVC',
  av1: 'AV1',
  vp9: 'VP9',
  mpeg4: 'MPEG-4',
  opus: 'Opus',
  aac: 'AAC',
  ac3: 'AC-3',
  eac3: 'E-AC-3',
  flac: 'FLAC',
  mp3: 'MP3',
  dts: 'DTS',
  truehd: 'TrueHD',
  vorbis: 'Vorbis',
  ass: 'ASS',
  ssa: 'SSA',
  subrip: 'SRT',
  srt: 'SRT',
  webvtt: 'WebVTT',
  mov_text: 'MOV Text',
  hdmv_pgs_subtitle: 'PGS',
  dvd_subtitle: 'VobSub',
  dvb_subtitle: 'DVB',
}

/** Nome de exibição do codec a partir do nome do ffprobe (`hdmv_pgs_subtitle` → "PGS"). */
export function codecLabel(codec?: string | null): string | undefined {
  if (!codec) return undefined
  return CODEC_LABELS[codec.toLowerCase()] ?? codec.toUpperCase()
}

/** Tamanho em bytes como "183 MB" ou "1,4 GB". */
export function sizeLabel(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: unit >= 3 ? 1 : 0 })} ${units[unit]}`
}

/** Bitrate em bits/s como "1,1 Mb/s" ou "112 kb/s". */
export function bitrateLabel(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Mb/s`
  }
  return `${Math.round(bitsPerSecond / 1000)} kb/s`
}
