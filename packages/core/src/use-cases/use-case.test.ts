import { describe, expect, expectTypeOf, it } from 'vitest'
import type { IUseCase, UseCaseInput, UseCaseOutput } from './index.ts'

class DoubleUseCase implements IUseCase<number, string> {
  async execute(input: number): Promise<string> {
    return String(input * 2)
  }
}

describe('IUseCase', () => {
  it('uma classe com execute implementa o contrato', async () => {
    const useCase: IUseCase<number, string> = new DoubleUseCase()
    expect(await useCase.execute(2)).toBe('4')
  })

  it('UseCaseInput e UseCaseOutput extraem os tipos do use case', () => {
    expectTypeOf<UseCaseInput<DoubleUseCase>>().toEqualTypeOf<number>()
    expectTypeOf<UseCaseOutput<DoubleUseCase>>().toEqualTypeOf<string>()
  })
})
