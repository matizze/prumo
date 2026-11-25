import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../errors.ts'
import { useCaseNames } from '../lib/names.ts'
import type { ChangePlan } from '../lib/plan.ts'
import { generatedApp } from '../test/app.ts'
import { fixturePlan } from '../test/fixture-project.ts'
import { registerUseCase, registerUseCaseDomain } from './register-use-case.ts'

const DOMAIN_INDEX = `import type { UseCaseDeps } from '../deps'

export function createAuthUseCases(deps: UseCaseDeps) {
  return {}
}

export const authRoutes = {}
`

const read = (plan: ChangePlan, file: string) => plan.source(path.join(plan.project.src, file)).getFullText()

/** O plano de fixture com o índice do domínio `auth`, como o gerador o cria. */
function planWithDomain() {
  const plan = fixturePlan()
  plan.createSource(path.join(plan.project.src, 'use-cases/auth/index.ts'), DOMAIN_INDEX)
  return plan
}

describe('registerUseCase', () => {
  it('acrescenta os imports, o use case e a rota de mock, cada um em ordem alfabética', () => {
    const plan = planWithDomain()
    registerUseCase(plan, useCaseNames('auth.sign-in'), { local: false })
    registerUseCase(plan, useCaseNames('auth.get-profile'), { local: false })
    registerUseCase(plan, useCaseNames('auth.sign-out'), { local: false })

    expect(read(plan, 'use-cases/auth/index.ts')).toBe(`import type { UseCaseDeps } from '../deps'
import { getProfileRoutes } from './mocks/get-profile'
import { signInRoutes } from './mocks/sign-in'
import { signOutRoutes } from './mocks/sign-out'
import { GetProfileUseCase } from './services/get-profile.usecase'
import { SignInUseCase } from './services/sign-in.usecase'
import { SignOutUseCase } from './services/sign-out.usecase'

export function createAuthUseCases(deps: UseCaseDeps) {
  return {
    getProfile: new GetProfileUseCase(deps.http),
    signIn: new SignInUseCase(deps.http),
    signOut: new SignOutUseCase(deps.http),
  }
}

export const authRoutes = {
  ...getProfileRoutes,
  ...signInRoutes,
  ...signOutRoutes,
}
`)
  })

  it('o use case local recebe o storage e não tem rota de mock', () => {
    const plan = planWithDomain()
    registerUseCase(plan, useCaseNames('auth.remember-me'), { local: true })
    const index = read(plan, 'use-cases/auth/index.ts')
    expect(index).toContain("import { RememberMeUseCase } from './services/remember-me.usecase'")
    expect(index).not.toContain('Routes } from')
    expect(index).toContain('rememberMe: new RememberMeUseCase(deps.storage),')
    expect(index).toContain('export const authRoutes = {}')
  })

  it('recusa a chave repetida e os arquivos que faltam ou mudaram', () => {
    const plan = planWithDomain()
    registerUseCase(plan, useCaseNames('auth.sign-in'), { local: false })
    expect(() => registerUseCase(plan, useCaseNames('auth.sign-in'), { local: false })).toThrow(
      "src/use-cases/auth/index.ts já tem o use case 'signIn'",
    )
    expect(() => registerUseCase(fixturePlan(), useCaseNames('auth.sign-in'), { local: false })).toThrow(
      /o projeto não tem src\/use-cases\/auth\/index.ts/,
    )
    const changed = fixturePlan()
    changed.createSource(
      path.join(changed.project.src, 'use-cases/auth/index.ts'),
      "export const authRoutes = {}\nexport const outro = () => 1\n",
    )
    expect(() => registerUseCase(changed, useCaseNames('auth.sign-in'), { local: false })).toThrow(
      "não tem a função 'createAuthUseCases' terminando em 'return { ... }'",
    )
  })
})

describe('registerUseCaseDomain', () => {
  it('o primeiro domínio troca o _deps por deps e entra nas três partes do registro', () => {
    const plan = fixturePlan()
    expect(read(plan, 'use-cases/index.ts')).toContain('createUseCases(_deps: UseCaseDeps)')

    registerUseCaseDomain(plan, useCaseNames('auth.sign-in'))

    const index = read(plan, 'use-cases/index.ts')
    expect(index).toContain("import { createAuthUseCases, authRoutes } from './auth'\nimport type { UseCaseDeps } from './deps'")
    expect(index).toContain('export const mockRoutes = {\n  ...authRoutes,\n}')
    expect(index).toContain('export function createUseCases(deps: UseCaseDeps) {\n  return {\n    ...createAuthUseCases(deps),\n  }\n}')
  })

  it('os domínios seguintes entram em ordem alfabética, e o que já está no registro fica como está', () => {
    const plan = fixturePlan()
    registerUseCaseDomain(plan, useCaseNames('stores.get-stores'))
    registerUseCaseDomain(plan, useCaseNames('auth.sign-in'))
    registerUseCaseDomain(plan, useCaseNames('orders.get-orders'))
    const once = read(plan, 'use-cases/index.ts')
    expect(once).toContain(
      '  return {\n    ...createAuthUseCases(deps),\n    ...createOrdersUseCases(deps),\n    ...createStoresUseCases(deps),\n  }',
    )
    expect(once).toContain('export const mockRoutes = {\n  ...authRoutes,\n  ...ordersRoutes,\n  ...storesRoutes,\n}')
    expect(once).toContain(
      "import { createAuthUseCases, authRoutes } from './auth'\nimport type { UseCaseDeps } from './deps'\nimport { DATA_SOURCES, type UseCaseOptions } from './options'\nimport { createOrdersUseCases, ordersRoutes } from './orders'\nimport { createStoresUseCases, storesRoutes } from './stores'",
    )
    registerUseCaseDomain(plan, useCaseNames('auth.sign-out'))
    expect(read(plan, 'use-cases/index.ts')).toBe(once)
  })

  it('sem o registro, ou sem o createUseCases e o mockRoutes, diz o que falta', () => {
    const plan = fixturePlan()
    expect(generatedApp()['src/use-cases/index.ts']).toContain('export const mockRoutes = {}')
    plan.source(path.join(plan.project.src, 'use-cases/index.ts')).replaceWithText('export const x = 1\n')
    expect(() => registerUseCaseDomain(plan, useCaseNames('auth.sign-in'))).toThrow(UsageError)
    expect(() => registerUseCaseDomain(plan, useCaseNames('auth.sign-in'))).toThrow(
      "não tem a função 'createUseCases' terminando em 'return { ... }'",
    )
  })
})
