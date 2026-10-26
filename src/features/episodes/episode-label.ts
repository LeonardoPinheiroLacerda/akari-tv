import type { VideoFileResponse } from '@/api/generated/akariAPI.schemas'

/** "T1 · E37" quando o arquivo tem pareamento; sem pareamento, nada. */
export function episodeNumberLabel(
  episode: VideoFileResponse,
): string | undefined {
  const pairing = episode.tmdbPairing
  if (pairing?.seasonNumber == null || pairing.episodeNumber == null)
    return undefined
  return `T${pairing.seasonNumber} · E${pairing.episodeNumber}`
}

/** Título do episódio (TMDB) ou, sem pareamento, o nome do arquivo. */
export function episodeTitle(episode: VideoFileResponse): string {
  return episode.tmdbPairing?.episodeName ?? episode.name
}
