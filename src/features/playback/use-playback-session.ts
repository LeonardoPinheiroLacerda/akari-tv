import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/errors'
import type { PlaybackSessionResponse } from '@/api/generated/akariAPI.schemas'
import {
  heartbeatPlaybackSession,
  seekPlaybackSession,
  startPlaybackSession,
  switchPlaybackSessionTracks,
} from '@/api/generated/playback/playback'
import { getServerUrl } from '@/api/mutator'
import { queryClient } from '@/api/queryClient'
import { useUserId } from '@/lib/profile'
import { nativePlayback } from './native-player'

// Profile de transcode do dispositivo. No app, o alvo é o Google TV Streamer,
// que tem estratégia própria no backend (H.264/HEVC/AV1 até 4K/60fps, áudio
// AAC); no navegador, `WEB` — HEVC só toca em alguns navegadores e máquinas.
const PROFILE = nativePlayback ? 'GOOGLE_TV_STREAMER' : 'WEB'
// Heartbeat a cada terço do TTL; o TTL real vem da resposta do próprio heartbeat.
const DEFAULT_TTL_SECONDS = 30
const MIN_HEARTBEAT_MS = 5000
// Listagens que trazem o progresso do perfil: os episódios de um anime e os
// downloads de torrent (as Novidades da Início).
const WATCH_PROGRESS_URL = /^\/v1\/(metadata\/animes\/\d+\/episodes|torrent\/downloads)$/

export interface TrackSelection {
  /** Posição no array `audio` do mediaprobe. */
  audio: number
  /** Posição no array `subtitles` do mediaprobe; `null` sem legenda. */
  subtitle: number | null
}

/**
 * Fonte HLS atual. Muda (`key`) sempre que o transcode reinicia num novo
 * offset — início, seek para fora do trecho já transcodificado, troca de
 * faixas — e o player recarrega a playlist. `localStart` é onde o `<video>`
 * começa dentro dela (`alvo - offset`).
 */
export interface PlaybackSource {
  key: number
  url: string
  offset: number
  localStart: number
}

export type SessionState =
  | { kind: 'starting' }
  | { kind: 'active' }
  | { kind: 'stale' }
  | { kind: 'error'; message: string }

/**
 * Inicia a sessão e, para retomar no meio, já a reposiciona (a sessão nova
 * começa do início). Sem `selection`, as faixas saem das preferências do
 * backend (`playback.default.*`); com ela, "sem legenda" precisa ir explícito
 * (`subtitleDisabled`), senão o backend aplicaria a legenda padrão. Com
 * `userId`, a posição dos heartbeats vira o progresso do perfil no arquivo.
 */
async function requestSession(
  fileId: number,
  userId: number | undefined,
  selection: TrackSelection | undefined,
  position: number,
): Promise<PlaybackSessionResponse> {
  const response = await startPlaybackSession({
    fileId,
    profile: PROFILE,
    ...(userId !== undefined && { userId }),
    ...(selection && {
      audioTrackIndex: selection.audio,
      subtitleTrackIndex: selection.subtitle,
      subtitleDisabled: selection.subtitle === null,
    }),
  })
  if (position <= 1) return response
  return seekPlaybackSession(response.sessionId, { positionSeconds: position })
}

export const TRANSCODE_FAILED_MESSAGE = 'Não foi possível converter este vídeo.'

/**
 * `TRANSCODE_FAILED` (500): o transcode morreu e a sessão não se recupera
 * sozinha. Pode vir do start, do seek, da troca de faixas e da playlist —
 * em todos é erro terminal: para de tentar e mostra o erro.
 */
function isTranscodeFailed(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'TRANSCODE_FAILED'
}

function messageOf(error: unknown): string {
  if (isTranscodeFailed(error)) return TRANSCODE_FAILED_MESSAGE
  return error instanceof ApiError ? error.message : 'Sem resposta do servidor.'
}

/**
 * Faixas ativas informadas pelo backend na resposta da sessão. Mantém a
 * referência anterior quando não mudam (seek), para não reiniciar o heartbeat.
 */
function tracksOf(response: PlaybackSessionResponse) {
  return (previous: TrackSelection | undefined): TrackSelection => {
    const audio = response.audioTrackIndex
    const subtitle = response.subtitleTrackIndex ?? null
    if (previous?.audio === audio && previous.subtitle === subtitle) {
      return previous
    }
    return { audio, subtitle }
  }
}

/**
 * Ciclo de vida da sessão de transcode (`/v1/playback/sessions`): inicia em
 * `startSeconds` com as faixas padrão das preferências do backend (as ativas
 * vêm na resposta e viram `tracks`; até lá, `undefined`), mantém viva com
 * heartbeat — que leva a posição atual, gravada no histórico do perfil —, reposiciona
 * (`seek`) e troca faixas. A posição que o resto do app usa é sempre a da mídia (absoluta); o
 * mapeamento para o tempo do `<video>` é `posição - offset` (contrato:
 * `startOffsetSeconds`).
 *
 * Sessão expirada (heartbeat `404`) é recriada na mesma posição. `404` ao
 * iniciar quer dizer que o arquivo saiu do cache: vira `stale`, e a tela volta
 * a preparar o arquivo.
 */
export function usePlaybackSession(fileId: number, startSeconds = 0) {
  const userId = useUserId()
  const [state, setState] = useState<SessionState>({ kind: 'starting' })
  const [source, setSource] = useState<PlaybackSource>()
  const [tracks, setTracks] = useState<TrackSelection>()

  const session = useRef<PlaybackSessionResponse | undefined>(undefined)
  const sourceKey = useRef(0)
  const alive = useRef(true)

  const applySource = useCallback(
    (response: PlaybackSessionResponse, position: number) => {
      session.current = response
      setTracks(tracksOf(response))
      sourceKey.current += 1
      setSource({
        key: sourceKey.current,
        url: `${getServerUrl()}${response.playlistUrl}`,
        offset: response.startOffsetSeconds,
        localStart: Math.max(0, position - response.startOffsetSeconds),
      })
    },
    [],
  )

  const start = useCallback(
    (selection: TrackSelection | undefined, position: number) =>
      requestSession(fileId, userId, selection, position).then(
        (response) => {
          if (!alive.current) return
          applySource(response, position)
          setState({ kind: 'active' })
        },
        (error: unknown) => {
          if (!alive.current) return
          if (error instanceof ApiError && error.status === 404) {
            setState({ kind: 'stale' })
            return
          }
          setState({ kind: 'error', message: messageOf(error) })
        },
      ),
    [fileId, userId, applySource],
  )

  // Posição atual da mídia, informada pelo player; vai nos heartbeats e é
  // usada para recriar a sessão expirada no mesmo ponto. Até o player
  // informar, é onde a reprodução começa: um heartbeat logo no início não
  // pode gravar 0 por cima de onde o perfil tinha parado.
  const position = useRef(startSeconds)
  const reportPosition = useCallback((seconds: number) => {
    position.current = seconds
  }, [])

  // Só no início: trocas de faixa e seeks passam pelas funções abaixo. O
  // início é adiado para depois da montagem: o StrictMode (dev) monta,
  // desmonta e monta de novo de forma síncrona, e um `POST` disparado na
  // primeira montagem criaria uma segunda sessão (e um segundo ffmpeg) no
  // backend. Com o adiamento, a montagem descartada é cancelada antes.
  useEffect(() => {
    alive.current = true
    const timer = setTimeout(() => void start(undefined, startSeconds), 0)
    return () => {
      clearTimeout(timer)
      alive.current = false
    }
  }, [start, startSeconds])

  // Heartbeat: sem ele o backend encerra a sessão depois do TTL. Ao sair da
  // tela o heartbeat para e a sessão expira sozinha (não há endpoint de fim).
  const active = state.kind === 'active'
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let ttl = DEFAULT_TTL_SECONDS

    const beat = async () => {
      const current = session.current
      if (!current) return
      try {
        const response = await heartbeatPlaybackSession(current.sessionId, {
          positionSeconds: position.current,
        })
        ttl = response.expiresInSeconds || DEFAULT_TTL_SECONDS
      } catch (error) {
        if (!alive.current) return
        if (error instanceof ApiError && error.status === 404) {
          void start(tracks, position.current)
          return
        }
      }
      timer = setTimeout(beat, Math.max(MIN_HEARTBEAT_MS, (ttl * 1000) / 3))
    }
    void beat()
    return () => clearTimeout(timer)
  }, [active, start, tracks])

  // Ao sair do player, um último heartbeat grava onde o perfil parou (o
  // periódico pode estar até um terço do TTL atrás) e, com ele gravado, a
  // listagem de episódios montada por baixo recarrega o progresso.
  useEffect(() => {
    if (userId === undefined) return
    return () => {
      // A sessão e a posição de agora, na saída, não as da montagem.
      const current = session.current
      if (!current) return
      void heartbeatPlaybackSession(current.sessionId, {
        positionSeconds: position.current,
      })
        .catch(() => undefined)
        .then(() =>
          queryClient.invalidateQueries({
            predicate: (query) =>
              query.queryKey.some(
                (part) => typeof part === 'string' && WATCH_PROGRESS_URL.test(part),
              ),
          }),
        )
    }
  }, [userId])

  /**
   * Reposiciona. Dentro do trecho já transcodificado o backend devolve o mesmo
   * offset e basta mover o `<video>` (`localTime`); fora dele o transcode
   * reinicia e a fonte é recarregada.
   */
  const seek = useCallback(
    async (target: number): Promise<{ localTime: number } | undefined> => {
      const current = session.current
      if (!current) return undefined
      try {
        const response = await seekPlaybackSession(current.sessionId, {
          positionSeconds: target,
        })
        if (response.startOffsetSeconds !== current.startOffsetSeconds) {
          applySource(response, target)
          return undefined
        }
        session.current = response
        setTracks(tracksOf(response))
        return { localTime: target - response.startOffsetSeconds }
      } catch (error) {
        if (!alive.current) return undefined
        if (isTranscodeFailed(error)) {
          setState({ kind: 'error', message: messageOf(error) })
        } else if (error instanceof ApiError && error.status === 404) {
          void start(tracks, target)
        }
        return undefined
      }
    },
    [applySource, start, tracks],
  )

  /** Troca áudio/legenda: o transcode sempre reinicia no instante informado. */
  const switchTracks = useCallback(
    async (selection: TrackSelection, at: number) => {
      const current = session.current
      setTracks(selection)
      if (!current) return
      try {
        const response = await switchPlaybackSessionTracks(current.sessionId, {
          positionSeconds: at,
          audioTrackIndex: selection.audio,
          subtitleTrackIndex: selection.subtitle,
        })
        applySource(response, at)
      } catch (error) {
        if (!alive.current) return
        if (isTranscodeFailed(error)) {
          setState({ kind: 'error', message: messageOf(error) })
        } else if (error instanceof ApiError && error.status === 404) {
          void start(selection, at)
        }
      }
    },
    [applySource, start],
  )

  const retry = useCallback(() => {
    setState({ kind: 'starting' })
    void start(tracks, position.current)
  }, [start, tracks])

  return { state, source, tracks, seek, switchTracks, reportPosition, retry }
}
