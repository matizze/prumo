import { describe, expect, it } from 'vitest'
import { domainNames } from '../lib/names.ts'
import { ChangePlan } from '../lib/plan.ts'
import { findProject } from '../lib/project.ts'
import { makeProject } from '../test-support.ts'
import { registerSchema } from './register-schema.ts'
import { fixturePlan } from './test-support.ts'

const text = (plan: ChangePlan) => plan.source(`${plan.project.src}/schemas/index.ts`).getFullText()

describe('registerSchema', () => {
  it('acrescenta o export da entidade depois do último', () => {
    const plan = fixturePlan()

    registerSchema(plan, domainNames('suppliers'))

    expect(text(plan)).toBe(`export * from './entities/user'
export * from '@matizze/prumo-core/data'
export * from './entities/customer'
export * from './forms/sign-in'
export {
  profileSchema,
  type ProfileSchema,
} from './entities/account'
export * from './entities/ai'
export * from './entities/supplier'
`)
  })

  it('segue o estilo do arquivo: aspas duplas e ponto e vírgula', () => {
    const root = makeProject({ 'src/schemas/index.ts': 'export * from "./entities/ai";\n' })
    const plan = new ChangePlan(findProject(root))

    registerSchema(plan, domainNames('suppliers'))

    expect(text(plan)).toBe(
      'export * from "./entities/ai";\nexport * from "./entities/supplier";\n',
    )
  })

  it('põe o primeiro export no fim de um índice sem nenhum, vazio ou só com comentário', () => {
    for (const [before, after] of [
      ['', "export * from './entities/supplier'\n"],
      ['\n', "\nexport * from './entities/supplier'\n"],
      [
        '// Schemas, um por entidade.\n',
        "// Schemas, um por entidade.\nexport * from './entities/supplier'\n",
      ],
      ['// sem quebra', "// sem quebra\nexport * from './entities/supplier'\n"],
    ] as const) {
      const plan = new ChangePlan(findProject(makeProject({ 'src/schemas/index.ts': before })))

      registerSchema(plan, domainNames('suppliers'))

      expect(text(plan)).toBe(after)
    }
  })

  it('um comentário na linha do último export fica com ele', () => {
    for (const [before, after] of [
      [
        "export * from './entities/ai' // nota\n",
        "export * from './entities/ai' // nota\nexport * from './entities/supplier'\n",
      ],
      [
        "export * from './entities/ai' /* nota */\n// fim\n",
        "export * from './entities/ai' /* nota */\nexport * from './entities/supplier'\n// fim\n",
      ],
      [
        "export * from './entities/ai' // sem quebra no fim",
        "export * from './entities/ai' // sem quebra no fim\nexport * from './entities/supplier'\n",
      ],
    ] as const) {
      const plan = new ChangePlan(findProject(makeProject({ 'src/schemas/index.ts': before })))
      registerSchema(plan, domainNames('suppliers'))
      expect(text(plan)).toBe(after)
    }
  })

  it('recusa a entidade que já está exportada e o índice que não existe', () => {
    expect(() => registerSchema(fixturePlan(), domainNames('customers'))).toThrow(
      /src\/schemas\/index\.ts já exporta '.\/entities\/customer'/,
    )

    const without = new ChangePlan(findProject(makeProject({}, ['src'])))
    expect(() => registerSchema(without, domainNames('suppliers'))).toThrow(
      'o projeto não tem src/schemas/index.ts.',
    )
  })
})
