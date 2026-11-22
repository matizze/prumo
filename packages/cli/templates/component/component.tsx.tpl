export interface {{component.pascal}}Props {
  title: string
}

export function {{component.pascal}}({ title }: {{component.pascal}}Props) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  )
}
