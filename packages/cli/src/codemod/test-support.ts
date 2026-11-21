import { cpSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findProject, type Project } from '../project.ts'
import { makeDir } from '../test-support.ts'
import { ChangePlan } from './plan.ts'
import { innerText } from './edit.ts'
import { pathLiteral, routeElements, type RouteElement } from './route-elements.ts'

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'app')

/** Uma cópia do projeto de fixture (o app em miniatura) numa pasta temporária. */
export function fixtureProject(): Project {
  const root = makeDir()
  cpSync(FIXTURE, root, { recursive: true })
  return findProject(root)
}

/** Um plano novo sobre uma cópia do projeto de fixture. */
export function fixturePlan(): ChangePlan {
  return new ChangePlan(fixtureProject())
}

/** O conteúdo de um arquivo criado pelo plano, pelo caminho relativo à raiz. */
export function createdText(plan: ChangePlan, relative: string): string {
  const file = path.join(plan.project.root, relative)
  const source = plan.createdSources().find((candidate) => candidate.getFilePath() === file)
  if (!source) throw new Error(`o plano não criou ${relative}`)
  return source.getFullText()
}

/**
 * O `<Route>` do `App.tsx` do plano com o `path` dado, o `nth`-ésimo do arquivo (do zero), como o
 * `findReferenceRoute` o entrega ao `registerRoute`.
 */
export function routeAt(plan: ChangePlan, routePath: string, nth = 0): RouteElement {
  const found = routeElements(plan.source(plan.project.app)).filter((element) => {
    const literal = pathLiteral(element)
    return literal !== undefined && innerText(literal) === routePath
  })
  const route = found[nth]
  if (!route) throw new Error(`o App.tsx do teste não tem a rota ${routePath} (${nth})`)
  return route
}
