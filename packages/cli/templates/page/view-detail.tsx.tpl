import type { {{page.pascal}}Model } from './model'

export function {{page.pascal}}View(m: {{page.pascal}}Model) {
  return (
    <main>
      <h1>{m.title}</h1>
      {m.loading ? (
        <p>{m.loadingText}</p>
      ) : m.failed || !m.item ? (
        <p role="alert">{m.failedText}</p>
      ) : (
        <p>{m.item.{{field.name}}}</p>
      )}
    </main>
  )
}
