// @vitest-environment jsdom
import { findByText, getConfig } from '@testing-library/dom'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { setMediaQuery } from './match-media.ts'
import { setupDom } from './setup.ts'

// O que o `onReset` vê no storage prova que ele roda antes da limpeza
const seenByReset: { storage: string | null; cookie: string }[] = []
function onReset() {
  seenByReset.push({ storage: localStorage.getItem('locale'), cookie: document.cookie })
}

setupDom({ onReset })

// Os testes abaixo rodam em ordem: o primeiro suja o jsdom e o segundo confere a limpeza
describe('setupDom', () => {
  it('instala o que o jsdom não implementa e configura o Testing Library', async () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000)
    expect(() => window.scrollTo(0, 0)).not.toThrow()
    expect(document.elementFromPoint(0, 0)).toBeNull()
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false)
    setMediaQuery('(prefers-color-scheme: dark)', true)
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(true)

    // Sujeira que a limpeza do afterEach precisa desfazer
    render(createElement('p', null, 'montado'))
    expect(await findByText(document.body, 'montado')).toBeTruthy()
    document.cookie = 'sessao=abc; Path=/'
    localStorage.setItem('locale', 'en')
    document.documentElement.className = 'dark'
    document.documentElement.style.colorScheme = 'dark'
  })

  it('depois de cada teste desmonta, zera o matchMedia e limpa cookies, storage e <html>', () => {
    expect(document.body.textContent).toBe('')
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false)
    expect(document.cookie).toBe('')
    expect(localStorage.length).toBe(0)
    expect(document.documentElement.className).toBe('')
    expect(document.documentElement.getAttribute('style')).toBeNull()
  })

  it('roda o onReset antes de limpar o storage e os cookies', () => {
    expect(seenByReset).toHaveLength(2)
    expect(seenByReset[0]).toEqual({ storage: 'en', cookie: 'sessao=abc' })
  })
})
