// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMatchMedia, resetMatchMedia, setMediaQuery } from './match-media.ts'

const DARK = '(prefers-color-scheme: dark)'

beforeEach(() => {
  installMatchMedia()
})

afterEach(() => {
  resetMatchMedia()
})

describe('matchMedia controlável', () => {
  it('começa sem casar com nenhuma consulta', () => {
    expect(window.matchMedia(DARK).matches).toBe(false)
    expect(window.matchMedia(DARK).media).toBe(DARK)
  })

  it('setMediaQuery muda o resultado da mesma MediaQueryList', () => {
    const mql = window.matchMedia(DARK)

    setMediaQuery(DARK, true)

    expect(mql.matches).toBe(true)
    expect(window.matchMedia(DARK).matches).toBe(true)
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(false)
  })

  it('notifica o change só de quem escuta a consulta', () => {
    const dark = vi.fn()
    const wide = vi.fn()
    window.matchMedia(DARK).addEventListener('change', dark)
    window.matchMedia('(min-width: 1024px)').addEventListener('change', wide)

    setMediaQuery(DARK, true)

    expect(dark).toHaveBeenCalledTimes(1)
    expect(dark).toHaveBeenCalledWith(expect.objectContaining({ matches: true, media: DARK }))
    expect(wide).not.toHaveBeenCalled()
  })

  it('não notifica quando o valor não muda', () => {
    const listener = vi.fn()
    window.matchMedia(DARK).addEventListener('change', listener)

    setMediaQuery(DARK, false)
    setMediaQuery(DARK, true)
    setMediaQuery(DARK, true)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('para de notificar depois do removeEventListener', () => {
    const listener = vi.fn()
    const mql = window.matchMedia(DARK)
    mql.addEventListener('change', listener)
    mql.removeEventListener('change', listener)

    setMediaQuery(DARK, true)

    expect(listener).not.toHaveBeenCalled()
  })

  it('aceita a API legada addListener e removeListener', () => {
    const listener = vi.fn()
    const mql = window.matchMedia(DARK)
    mql.addListener(listener)

    setMediaQuery(DARK, true)
    mql.removeListener(listener)
    setMediaQuery(DARK, false)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('resetMatchMedia volta tudo ao início e solta os listeners', () => {
    const listener = vi.fn()
    window.matchMedia(DARK).addEventListener('change', listener)
    setMediaQuery(DARK, true)
    listener.mockClear()

    resetMatchMedia()
    setMediaQuery(DARK, true)

    expect(window.matchMedia(DARK).matches).toBe(true)
    expect(listener).not.toHaveBeenCalled()
  })
})
