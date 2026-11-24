import { createRuleTester, inProject } from '../rule-tester.ts'
import { useCaseImports } from './use-case-imports.ts'

const useCase = inProject('src/use-cases/livros/list-livros.usecase.ts')

const page = (specifier: string) => ({ messageId: 'page' as const, data: { specifier } })
const ui = (library: string, specifier: string) => ({
  messageId: 'ui' as const,
  data: { package: library, specifier },
})

createRuleTester().run('use-case-imports', useCaseImports, {
  valid: [
    // O que o use case usa: http, storage, schemas, o core e outros use cases
    { filename: useCase, code: "import { z } from 'zod'" },
    { filename: useCase, code: "import type { Http } from '@matizze/prumo-core/http'" },
    { filename: useCase, code: "import { LivroSchema } from '@/schemas'" },
    { filename: useCase, code: "import { ListLivrosInput } from './list-livros.types'" },
    { filename: useCase, code: "import { GetLivroUseCase } from '../livros/get-livro.usecase'" },
    // Nomes que só começam como react ou como pacotes de outros escopos
    { filename: useCase, code: "import { x } from 'react-hook-form-like'" },
    { filename: useCase, code: "import { x } from '@tanstackish/x'" },
    // Fora de src/use-cases, a regra não olha
    { filename: inProject('src/pages/livros/model.ts'), code: "import { useQuery } from '@tanstack/react-query'" },
    { filename: inProject('src/providers/use-cases/index.ts'), code: "import { createContext } from 'react'" },
    // Opções
    {
      filename: inProject('app/domain/livros/x.usecase.ts'),
      code: "import { x } from '~/pages/y'",
      options: [{ alias: '~/', aliasRoot: 'app', pagesDir: 'app/screens', useCasesDir: 'app/domain' }],
    },
  ],
  invalid: [
    { filename: useCase, code: "import { Page } from '@/pages/livros'", errors: [page('@/pages/livros')] },
    {
      filename: useCase,
      code: "import { x } from '../../pages/livros/model'",
      errors: [page('../../pages/livros/model')],
    },
    { filename: useCase, code: "import { useState } from 'react'", errors: [ui('react', 'react')] },
    {
      filename: useCase,
      code: "import { jsx } from 'react/jsx-runtime'",
      errors: [ui('react', 'react/jsx-runtime')],
    },
    {
      filename: useCase,
      code: "import { useQuery } from '@tanstack/react-query'",
      errors: [ui('@tanstack', '@tanstack/react-query')],
    },
    {
      filename: useCase,
      code: "import type { QueryClient } from '@tanstack/query-core'",
      errors: [ui('@tanstack', '@tanstack/query-core')],
    },
    {
      filename: inProject('src/use-cases/livros/index.ts'),
      code: "export * from '@/pages/livros'",
      errors: [page('@/pages/livros')],
    },
    {
      filename: inProject('app/domain/livros/x.usecase.ts'),
      code: "import { x } from '~/screens/y'",
      options: [{ alias: '~/', aliasRoot: 'app', pagesDir: 'app/screens', useCasesDir: 'app/domain' }],
      errors: [page('~/screens/y')],
    },
  ],
})
