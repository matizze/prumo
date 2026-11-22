import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import type { Runtime } from './runtime.ts'

/** Uma versão simples do pnpm: x.y.z, com pré-lançamento opcional (10.5.0, 11.0.0-rc.1). */
const SIMPLE_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/

/** A versão, se for um semver simples; senão `undefined`. Nada que venha de fora passa sem isto. */
export function validPnpmVersion(text: string | undefined): string | undefined {
  const version = text?.trim()
  return version && SIMPLE_SEMVER.test(version) ? version : undefined
}

/**
 * O pnpm que a pessoa usa, perguntando a ele (`pnpm --version`). Roda fora do projeto e sem baixar
 * versões, porque nem o doctor nem o new usam a rede para isto. `undefined` se o pnpm não existe.
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
 * A versão do pnpm que o `new` fixa em `packageManager`: a do `npm_config_user_agent` do runtime
 * quando começa com `pnpm/<versão>` (o que o pnpm põe no ambiente em `dlx`, `exec` e `create`) e,
 * senão, a que o próprio pnpm informa. Só vale um semver simples; sem versão válida, `undefined`.
 */
export function detectPnpmVersion(
  runtime: Runtime,
  ask: () => string | undefined = pnpmVersion,
): string | undefined {
  const agent = /^pnpm\/(\S+)/.exec(runtime.env.npm_config_user_agent ?? '')
  return validPnpmVersion(agent?.[1]) ?? validPnpmVersion(ask())
}
