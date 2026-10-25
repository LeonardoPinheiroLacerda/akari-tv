/** Converte rem (dp de design / 16, seção 3) para px de CSS do viewport atual. */
export function remToPx(rem: number): number {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}
