import type { Chapter } from '@/api/generated/akariAPI.schemas'

// Os capítulos são reconhecidos pelo título, como vêm no arquivo:
// "Abertura", "Abertura 「Kyoukaisen」", "Opening", "OP1", "Intro"…
const OPENING = /^(abertura|opening|op\d*\b|intro)/i
// …e no fim, "Encerramento", "Ending", "ED1", "Créditos" e a "Prévia" do
// próximo episódio, que vem depois deles.
const CREDITS =
  /^(encerramento|ending|ed\d*\b|créditos|credits|prévia|preview)/i

const titled = (chapter: Chapter, pattern: RegExp) =>
  pattern.test(chapter.title?.trim() ?? '')

/**
 * Capítulo de abertura em que a posição está. No último segundo dele já não
 * conta: pular dali não adiantaria nada.
 */
export function openingAt(
  chapters: Chapter[],
  position: number,
): Chapter | undefined {
  return chapters.find(
    (chapter) =>
      titled(chapter, OPENING) &&
      chapter.startSeconds <= position &&
      position < chapter.endSeconds - 1,
  )
}

/**
 * Onde começam os créditos finais: o primeiro capítulo de encerramento ou de
 * prévia na segunda metade do arquivo. `undefined` sem esses capítulos.
 */
export function creditsStart(
  chapters: Chapter[],
  duration?: number,
): number | undefined {
  return chapters.find(
    (chapter) =>
      titled(chapter, CREDITS) &&
      (!duration || chapter.startSeconds >= duration / 2),
  )?.startSeconds
}
