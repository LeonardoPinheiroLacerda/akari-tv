import { KEY_BACKSPACE, KEY_CLEAR } from './search-keyboard'

/** Aplica uma tecla do teclado na tela (ou do físico) ao texto digitado. */
export function applyKey(
  text: string,
  value: string,
  maxLength: number,
): string {
  if (value === KEY_BACKSPACE) return text.slice(0, -1)
  if (value === KEY_CLEAR) return ''
  // Sem espaço no começo nem dois seguidos: não mudam o texto e só confundem o campo.
  if (value === ' ' && (text === '' || text.endsWith(' '))) return text
  return (text + value).slice(0, maxLength)
}
