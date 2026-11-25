/**
 * Uma ação do app com nome de verbo: recebe um `TInput`, faz o que precisa (chamar a API, ler o
 * navegador, compor outros use cases) e devolve um `TOutput`.
 */
export interface IUseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>
}

/** O tipo de entrada de um use case: `UseCaseInput<SignInUseCase>`. */
export type UseCaseInput<U> = U extends IUseCase<infer I, unknown> ? I : never

/** O tipo de saída de um use case: `UseCaseOutput<SignInUseCase>`. */
export type UseCaseOutput<U> = U extends IUseCase<never, infer O> ? O : never
