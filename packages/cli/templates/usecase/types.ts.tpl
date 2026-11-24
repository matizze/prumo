import { z } from 'zod'
{{types.schemaImport}}
{{types.endpoint}}/** O que o use case recebe. */
export const {{action.pascal}}Input = {{types.input}}

export type {{action.pascal}}Input = z.infer<typeof {{action.pascal}}Input>

/** O que o use case devolve. */
export const {{action.pascal}}Output = {{types.output}}

export type {{action.pascal}}Output = z.infer<typeof {{action.pascal}}Output>{{types.key}}
