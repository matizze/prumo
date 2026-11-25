import { z } from 'zod'
{{types.schemaImport}}
{{types.endpoint}}export const {{action.pascal}}Request = {{types.input}}

export type {{action.pascal}}Request = {{types.inputType}}

export const {{action.pascal}}Response = {{types.output}}

export type {{action.pascal}}Response = z.infer<typeof {{action.pascal}}Response>{{types.key}}
