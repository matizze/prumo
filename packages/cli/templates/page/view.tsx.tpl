import type { {{page.pascal}}Model } from './model'

export function {{page.pascal}}View(m: {{page.pascal}}Model) {
  return (
    <main>
      <h1>{m.title}</h1>
    </main>
  )
}
