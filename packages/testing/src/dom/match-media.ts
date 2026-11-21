/**
 * window.matchMedia controlável pelos testes (o jsdom não implementa).
 * Cada consulta começa sem casar (`matches: false`), o que equivale a desktop e tema claro.
 * `setMediaQuery` muda o resultado e dispara `change` nos listeners, como o navegador faz.
 */

type ChangeListener = (event: MediaQueryListEvent) => void

const matchesByQuery = new Map<string, boolean>()
const listenersByQuery = new Map<string, Set<ChangeListener>>()

function listenersOf(query: string): Set<ChangeListener> {
  let listeners = listenersByQuery.get(query)
  if (!listeners) {
    listeners = new Set()
    listenersByQuery.set(query, listeners)
  }
  return listeners
}

function createMediaQueryList(query: string): MediaQueryList {
  const mql = {
    media: query,
    // Getter: como no navegador, a mesma MediaQueryList reflete o valor atual
    get matches() {
      return matchesByQuery.get(query) ?? false
    },
    onchange: null,
    addEventListener: (_type: string, listener: ChangeListener) => listenersOf(query).add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) =>
      listenersOf(query).delete(listener),
    // API legada (Safari < 14)
    addListener: (listener: ChangeListener) => listenersOf(query).add(listener),
    removeListener: (listener: ChangeListener) => listenersOf(query).delete(listener),
    dispatchEvent: () => true,
  }
  return mql as unknown as MediaQueryList
}

export function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => createMediaQueryList(query),
  })
}

/** Define se `query` casa e notifica quem escuta `change` nessa consulta. */
export function setMediaQuery(query: string, matches: boolean) {
  if ((matchesByQuery.get(query) ?? false) === matches) return
  matchesByQuery.set(query, matches)
  const event = { matches, media: query } as MediaQueryListEvent
  for (const listener of [...listenersOf(query)]) listener(event)
}

export function resetMatchMedia() {
  matchesByQuery.clear()
  listenersByQuery.clear()
}
