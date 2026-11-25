import { expect, it } from 'vitest'
import { defineContractSuite } from '../../contract.ts'

/** Um conjunto de notas mínimo, o suficiente para o contrato ter o que conferir. */
export interface Notes {
  add(text: string): Promise<string>
  get(id: string): Promise<string>
  count(): Promise<number>
}

/** O contrato das notas: o que qualquer implementação de `Notes` cumpre. */
export const notesContract = defineContractSuite<Notes>('Notes', ({ subject }) => {
  it('guarda a nota e devolve pelo id', async () => {
    const id = await subject.add('comprar leite')
    expect(await subject.get(id)).toBe('comprar leite')
  })

  it('começa vazio em cada teste', async () => {
    expect(await subject.count()).toBe(0)
  })

  it('recusa um id que não existe', async () => {
    await expect(subject.get('nota_inexistente')).rejects.toThrow('NOTA_NAO_ENCONTRADA')
  })
})

/** A implementação certa: um `Map` em memória. */
export class MapNotes implements Notes {
  readonly #notes = new Map<string, string>()

  add(text: string): Promise<string> {
    const id = `nota_${this.#notes.size + 1}`
    this.#notes.set(id, text)
    return Promise.resolve(id)
  }

  get(id: string): Promise<string> {
    const text = this.#notes.get(id)
    return text === undefined
      ? Promise.reject(new Error('NOTA_NAO_ENCONTRADA'))
      : Promise.resolve(text)
  }

  count(): Promise<number> {
    return Promise.resolve(this.#notes.size)
  }
}

/** Uma implementação com defeito: guarda tudo em maiúsculas e devolve `undefined` para o id que falta. */
export class BrokenNotes extends MapNotes {
  override async add(text: string): Promise<string> {
    return super.add(text.toUpperCase())
  }

  override get(id: string): Promise<string> {
    return super.get(id).catch(() => undefined as unknown as string)
  }
}
