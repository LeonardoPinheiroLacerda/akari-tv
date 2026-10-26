import { useEffect, useState } from 'react'

// Espera o foco assentar antes de trocar o hero: navegando rápido pela grade,
// só o item onde o usuário parou decodifica o banner (seção 7: imagens grandes
// decodificadas uma por vez).
export const SETTLE_MS = 250

export function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  // Primeiro valor (nada exibido ainda) aparece na hora.
  return settled ?? value
}
