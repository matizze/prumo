import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Project } from './project.ts'

/** Uma versão simples do pnpm: x.y.z, com pré-lançamento opcional (10.5.0, 11.0.0-rc.1). */
const SIMPLE_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/

/** A versão, se for um semver simples; senão `undefined`. Nada que venha de fora passa sem isto. */
export function validPnpmVersion(text: string | undefined): string | undefined {
  const version = text?.trim()
  return version && SIMPLE_SEMVER.test(version) ? version : undefined
}

/**
 * O pnpm que a pessoa usa, perguntando a ele (`pnpm --version`). Roda fora do projeto e sem baixar
 * versões, porque o `new` não usa a rede para isto. `undefined` se o pnpm não existe.
 */
export function pnpmVersion(): string | undefined {
  const result = spawnSync('pnpm', ['--version'], {
    cwd: tmpdir(),
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      COREPACK_ENABLE_NETWORK: '0',
      COREPACK_ENABLE_AUTO_PIN: '0',
      npm_config_manage_package_manager_versions: 'false',
    },
  })
  const version = result.stdout?.trim()
  return result.status === 0 && version ? version : undefined
}

/**
 * A versão do pnpm que o `new` fixa em `packageManager`: a do `npm_config_user_agent` quando começa
 * com `pnpm/<versão>` (o que o pnpm põe no ambiente em `dlx`, `exec` e `create`) e, senão, a que o
 * próprio pnpm informa (`ask`). Só vale um semver simples; sem versão válida, `undefined`.
 */
export function detectPnpmVersion(
  env: Readonly<Record<string, string | undefined>>,
  ask: () => string | undefined = pnpmVersion,
): string | undefined {
  const agent = /^pnpm\/(\S+)/.exec(env.npm_config_user_agent ?? '')
  return validPnpmVersion(agent?.[1]) ?? validPnpmVersion(ask())
}

/** O caminho como o shell o lê: entre aspas simples se tem espaço ou outro caractere especial. */
export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** Se o `package.json` do projeto tem o script (`test` roda o Vitest do projeto). */
function hasScript(project: Project, script: string): boolean {
  const file = path.join(project.root, 'package.json')
  if (!existsSync(file)) return false
  try {
    const scripts = (JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> })
      .scripts
    return typeof scripts?.[script] === 'string'
  } catch {
    return false
  }
}

/**
 * O comando que roda os testes de uma pasta do projeto (`src/pages/produtos`), para o mesmo
 * terminal onde o `prumo` rodou: o script `test` do projeto, se houver, e o Vitest direto, se não.
 * Na pasta do projeto é `pnpm <comando>`; fora dela, `pnpm --dir <pasta> <comando>`.
 */
export function testCommandFor(project: Project, cwd: string, target: string): string {
  const command = hasScript(project, 'test') ? `test ${target}` : `exec vitest run ${target}`
  const relative = path.relative(cwd, project.root)
  if (relative === '') return `pnpm ${command}`
  return `pnpm --dir ${shellQuote(relative.startsWith('..') ? project.root : relative)} ${command}`
}
