import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'
import { installMatchMedia, resetMatchMedia } from './match-media.ts'

export interface SetupDomOptions {
  /**
   * Tempo máximo, em ms, de `findBy*` e `waitFor` (padrão 5000). O padrão do Testing Library é
   * 1 s, pouco para uma tela inteira na primeira renderização com a suíte em paralelo numa
   * máquina carregada, e o teste falha sem defeito nenhum. 5 s dá folga sem esconder espera
   * infinita.
   */
  asyncUtilTimeout?: number
  /**
   * Roda depois de cada teste, após o `cleanup` e antes de limpar cookies e `localStorage`. É o
   * lugar de desfazer o que o produto liga ao storage, como o idioma salvo: trocar o idioma
   * regrava a chave `locale`, e a limpeza precisa vir depois.
   */
  onReset?: () => void
}

function clearCookies() {
  for (const row of document.cookie.split('; ')) {
    const name = row.split('=')[0]
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

/**
 * Prepara o jsdom para os testes de um produto. Chame uma vez, no arquivo de `setupFiles` do
 * Vitest (ambiente jsdom).
 *
 * - Instala o `matchMedia` controlável (`setMediaQuery`) e o `scrollTo` e o `elementFromPoint`,
 *   que o jsdom não implementa (o `input-otp` mede o caret com `elementFromPoint` em um timer).
 * - Configura o `asyncUtilTimeout` do Testing Library.
 * - Depois de cada teste: `cleanup` (sem `globals`, o Testing Library não o registra sozinho),
 *   `matchMedia` zerado, cookies, `localStorage` e a classe e o estilo do `<html>`.
 *
 * Não faz o que é do produto: o idioma de partida, `@testing-library/jest-dom/vitest` e o
 * `fake-indexeddb` ficam no `setup.ts` dele.
 */
export function setupDom({ asyncUtilTimeout = 5000, onReset }: SetupDomOptions = {}) {
  installMatchMedia()
  configure({ asyncUtilTimeout })
  window.scrollTo = () => {}
  document.elementFromPoint = () => null

  afterEach(() => {
    cleanup()
    resetMatchMedia()
    onReset?.()
    clearCookies()
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
  })
}
