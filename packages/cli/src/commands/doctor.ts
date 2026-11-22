import { defineCommand } from 'citty'
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runChecks, type DoctorSystem, type Finding, type Status } from '../doctor/checks.ts'
import { ExitError, UsageError } from '../errors.ts'
import type { Runtime } from '../runtime.ts'

const STATUS_TEXT: Record<Status, string> = { ok: 'ok   ', warn: 'aviso', error: 'erro ' }

/** Uma linha do relatório: o resultado, o que foi conferido e a explicação. */
export function formatFinding({ status, label, message }: Finding): string {
  return `${STATUS_TEXT[status]}  ${label}: ${message}`
}

/** O fim do relatório: a contagem de erros e avisos, ou "tudo certo". */
export function formatSummary(findings: readonly Finding[]): string {
  const count = (status: Status) => findings.filter((finding) => finding.status === status).length
  const errors = count('error')
  const warnings = count('warn')
  if (errors === 0 && warnings === 0) return 'prumo doctor: tudo certo.'
  const parts = [
    errors > 0 ? (errors === 1 ? '1 erro' : `${errors} erros`) : '',
    warnings > 0 ? (warnings === 1 ? '1 aviso' : `${warnings} avisos`) : '',
  ].filter(Boolean)
  return `prumo doctor: ${parts.join(' e ')}.`
}

/** O pnpm que a pessoa usa. Roda fora do projeto e sem baixar versões, porque o doctor não usa a rede. */
function pnpmVersion(): string | undefined {
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

function readText(file: string): string | undefined {
  try {
    return statSync(file).isFile() ? readFileSync(file, 'utf8') : undefined
  } catch {
    return undefined
  }
}

/** A versão desta CLI: o `package.json` do pacote, que fica duas pastas acima de `src/commands` e de `dist/commands`. */
function readCliVersion(): string {
  const manifest = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string }
  return manifest.version
}

/** O Node, o pnpm e o disco de verdade. Os testes passam o próprio. */
export function realSystem(): DoctorSystem {
  return {
    nodeVersion: process.versions.node,
    cliVersion: readCliVersion(),
    pnpmVersion,
    readText,
    env: (name) => process.env[name] || undefined,
  }
}

/**
 * `prumo doctor`: confere o ambiente e o projeto e escreve uma linha por item, com ok, aviso ou
 * erro. Sai com 0 (tudo certo, ou só avisos), com 1 se há erro e com 2 se a raiz não é um
 * projeto. Não escreve nada em disco e não usa a rede.
 */
export function createDoctorCommand(runtime: Runtime, injected?: DoctorSystem) {
  return defineCommand({
    meta: {
      name: 'doctor',
      description: `Confere o ambiente e o projeto: Node, pnpm, pacotes do Prumo e .mcp.json.

Cada item sai numa linha com ok, aviso ou erro: o Node (mínimo 24, e o .nvmrc do projeto), o pnpm
(contra o packageManager), a versão de cada @matizze/prumo-* instalado contra a faixa que esta CLI
espera e o .mcp.json (com o servidor prumo, o prumo-mcp, que dá ao agente as ferramentas do Prumo).
Se o .npmrc manda o escopo @matizze para o GitHub Packages, confere que a NODE_AUTH_TOKEN está
definida (só avisa; nunca mostra o valor).

Sai com 0 sem erro (avisos não falham), com 1 com erro e com 2 se a pasta não é um projeto. Não
escreve nada e não usa a rede.`,
    },
    args: {
      root: {
        type: 'string',
        valueHint: 'pasta',
        description: 'Pasta do projeto, a que tem o package.json. Padrão: a pasta atual.',
      },
    },
    run({ args }) {
      const system = injected ?? realSystem()
      const root = path.resolve(runtime.cwd, args.root ?? '.')
      if (system.readText(path.join(root, 'package.json')) === undefined) {
        throw new UsageError(
          `a pasta '${root}' não tem package.json: aponte --root para a raiz do projeto.`,
        )
      }
      const findings = runChecks({ root, system })
      runtime.out(`${findings.map(formatFinding).join('\n')}\n\n${formatSummary(findings)}\n`)
      if (findings.some((finding) => finding.status === 'error')) throw new ExitError(1)
    },
  })
}
