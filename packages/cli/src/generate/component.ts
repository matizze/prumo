import { existsSync } from 'node:fs'
import path from 'node:path'
import { assertValidName, ChangePlan, usableNames, type Names } from '../codemod/index.ts'
import { UsageError } from '../errors.ts'
import type { Project } from '../project.ts'
import { nameVars, renderTemplate, renderTemplateFile } from '../templates.ts'

/** O componente e o teste dele: o modelo e o nome do arquivo (sem a pasta), os dois com marcadores. */
export const COMPONENT_FILES = [
  { template: 'component/component.tsx.tpl', name: '{{component.kebab}}.tsx' },
  { template: 'component/component-test.tsx.tpl', name: '{{component.kebab}}.test.tsx' },
] as const

export interface ComponentRequest {
  /** O nome do componente, em kebab-case: `resumo-do-pedido`. */
  name: string
  /** A tela que recebe o componente (`src/pages/<tela>/components/`). */
  page?: string | undefined
  /** O componente é de uso comum (`src/components/shared/`). */
  shared?: boolean | undefined
}

export interface ComponentResult {
  plan: ChangePlan
  names: Names
  /** A pasta do componente, relativa à raiz do projeto, em posix. */
  folder: string
  /** O arquivo do componente, relativo à raiz do projeto. */
  file: string
  /** A tela, quando o componente é dela. */
  page?: Names
}

/**
 * Monta o plano de um componente novo, só com elementos HTML, e o teste dele: em
 * `src/pages/<tela>/components/` (`page`) ou em `src/components/shared/` (`shared`), um dos dois.
 * Nada vai para o disco. Valida o nome (kebab-case, sem palavra reservada nem nome global, que
 * viram o identificador do componente), a escolha entre a tela e o `shared` e a tela, que precisa
 * existir; todo erro de uso é um `UsageError` (saída 2).
 */
export function generateComponent(
  project: Project,
  { name, page, shared = false }: ComponentRequest,
): ComponentResult {
  const names = usableNames(name, 'o nome do componente', { globals: true })
  if (page !== undefined && shared) {
    throw new UsageError('use --page <tela> ou --shared, não os dois.')
  }
  if (page === undefined && !shared) {
    throw new UsageError(
      'diga onde o componente mora: --page <tela> (os da tela) ou --shared (os usados por duas ou mais telas).',
    )
  }

  let pageNames: Names | undefined
  let folder = 'src/components/shared'
  if (page !== undefined) {
    assertValidName(page, 'o nome da tela')
    pageNames = usableNames(page, 'o nome da tela')
    if (!existsSync(path.join(project.pages, pageNames.kebab))) {
      throw new UsageError(
        `a tela '${pageNames.kebab}' não existe: não há a pasta src/pages/${pageNames.kebab} (crie-a com prumo make:page ${pageNames.kebab}).`,
      )
    }
    folder = `src/pages/${pageNames.kebab}/components`
  }

  const vars = nameVars('component', names)
  const plan = new ChangePlan(project)
  for (const { template, name: fileName } of COMPONENT_FILES) {
    plan.createSource(
      path.join(project.root, folder, renderTemplate(fileName, vars)),
      renderTemplateFile(template, vars),
    )
  }
  return {
    plan,
    names,
    folder,
    file: `${folder}/${names.kebab}.tsx`,
    ...(pageNames ? { page: pageNames } : {}),
  }
}
