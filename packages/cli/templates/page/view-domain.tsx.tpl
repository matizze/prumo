import type { {{page.pascal}}Model } from './model'

export function {{page.pascal}}View(m: {{page.pascal}}Model) {
  return (
    <main>
      <h1>{m.title}</h1>
      {m.loading ? (
        <p>{m.loadingText}</p>
      ) : m.failed ? (
        <p role="alert">{m.failedText}</p>
      ) : (
        <ul>
          {m.items.map((i) => (
            <li key={i.id}>{i.name}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
