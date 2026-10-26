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
