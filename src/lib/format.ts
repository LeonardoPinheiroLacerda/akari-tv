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
  return score.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** Texto puro a partir da sinopse em HTML da API (quebras viram espaço). */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
