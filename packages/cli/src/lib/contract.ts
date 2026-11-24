/**
 * A entidade (`Livro`) que o contrato de um repositório (`repository.contract.ts`) usa: a da lista
 * (`Page<LivroSchema>`) ou, sem ela, o primeiro `<X>Schema` do texto. `undefined` se o contrato
 * não diz. É o jeito de o `make:query`, o `make:page` e o `list` descobrirem a entidade de um domínio.
 */
export function contractEntity(contract: string): string | undefined {
  return (
    /\bPage<\s*([A-Z][A-Za-z0-9]*)Schema\s*>/.exec(contract)?.[1] ??
    /\b([A-Z][A-Za-z0-9]*)Schema\b/.exec(contract)?.[1]
  )
}
