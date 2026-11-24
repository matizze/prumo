import type { {{page.pascal}}Model } from './model'

export function {{page.pascal}}View(m: {{page.pascal}}Model) {
  return (
    <main>
      <h1>{m.title}</h1>
      <form aria-label={m.title} onSubmit={m.onSubmit}>
{{form.fields}}        <button type="submit" disabled={m.submitting}>
          {m.submitText}
        </button>
      </form>
      {m.errorText && <p role="alert">{m.errorText}</p>}
      {m.succeeded && <p role="status">{m.successText}</p>}
    </main>
  )
}
