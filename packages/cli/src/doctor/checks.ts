import path from 'node:path'
import { MADS, UI_REGISTRY_NAMESPACE } from '../ds.ts'
import { parseEnvFile, variablesIn } from './env-file.ts'
import { CLI_PACKAGE_NAME, PRUMO_PACKAGES, PRUMO_PACKAGE_RANGES } from './ranges.ts'
import {
  caretRange,
  compareVersions,
  formatRange,
  formatVersion,
  parseRange,
  parseVersion,
  positionIn,
  type Range,
  type Version,
} from './versions.ts'

/** A versão mínima do Node que o Prumo exige (os comandos rodam `.ts` direto, com type stripping). */
export const MIN_NODE_MAJOR = 24

export type Status = 'ok' | 'warn' | 'error'

/** Uma linha do relatório: o que foi conferido, o resultado e a explicação. */
export interface Finding {
  status: Status
  label: string
  message: string
}

/**
 * O que o `doctor` pergunta ao sistema. O comando passa o Node e o disco de verdade; os testes
 * passam valores prontos e um mapa de arquivos, e assim não dependem da máquina.
 */
export interface DoctorSystem {
  /** A versão do Node que está rodando a CLI (`process.versions.node`). */
  nodeVersion: string
  /** A versão desta CLI, do `package.json` dela. */
  cliVersion: string
  /** A versão do pnpm instalado, ou `undefined` se o pnpm não existe. Não usa a rede. */
  pnpmVersion: () => string | undefined
  /** O conteúdo do arquivo, ou `undefined` se ele não existe ou não pode ser lido. */
  readText: (file: string) => string | undefined
}

export interface DoctorInput {
  root: string
  /** As variáveis de ambiente (têm prioridade sobre o `.env.local`). */
  env: Readonly<Record<string, string | undefined>>
  system: DoctorSystem
}

type Json = Record<string, unknown>

const DEFAULT_URL_VARIABLE = MADS.urlVariable
const DEFAULT_TOKEN_VARIABLE = MADS.tokenVariable

/** Roda todas as conferências e devolve as linhas, na ordem do relatório. Não escreve nada. */
export function runChecks(input: DoctorInput): Finding[] {
  const manifest = readJson(input.system, path.join(input.root, 'package.json')) ?? {}
  return [
    checkNode(input, manifest),
    checkPnpm(input, manifest),
    ...checkPackages(input, manifest),
    ...checkRegistry(input),
    ...checkProjectFiles(input),
  ]
}

function readJson(system: DoctorSystem, file: string): Json | undefined {
  const text = system.readText(file)
  if (text === undefined) return undefined
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Json)
      : undefined
  } catch {
    return undefined
  }
}

/** Procura o arquivo na pasta do projeto e, se não achar, nas pastas acima (um monorepo guarda o `.nvmrc` na raiz). */
function readUp(system: DoctorSystem, from: string, name: string): string | undefined {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const text = system.readText(path.join(dir, name))
    if (text !== undefined) return text
    if (path.dirname(dir) === dir) return undefined
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

// Node

function checkNode({ root, system }: DoctorInput, manifest: Json): Finding {
  const label = 'Node'
  const running = parseVersion(system.nodeVersion)
  if (!running) {
    return { status: 'error', label, message: `não entendi a versão '${system.nodeVersion}'.` }
  }
  const shown = formatVersion(running)
  if (running.major < MIN_NODE_MAJOR) {
    return {
      status: 'error',
      label,
      message: `${shown} é antiga: o Prumo exige Node >= ${MIN_NODE_MAJOR}. Instale o Node ${MIN_NODE_MAJOR} (nvm install ${MIN_NODE_MAJOR}).`,
    }
  }

  const notes = [`mínimo do Prumo: ${MIN_NODE_MAJOR}`]
  const warnings: string[] = []

  const nvmrc = readUp(system, root, '.nvmrc')?.trim()
  if (nvmrc !== undefined) {
    const wanted = parseVersion(nvmrc)
    if (!wanted) {
      warnings.push(`não entendi o .nvmrc ('${nvmrc}')`)
    } else if (
      nvmrc.split('.').length === 1 ? running.major !== wanted.major : !isSameLine(running, wanted)
    ) {
      warnings.push(`o .nvmrc pede ${nvmrc}: rode nvm use`)
    } else {
      notes.push(`.nvmrc: ${nvmrc}`)
    }
  }

  const engines = manifest.engines
  const enginesNode =
    typeof engines === 'object' && engines !== null ? asString((engines as Json).node) : undefined
  const enginesMin = enginesNode ? /^>=\s*(\S+)$/.exec(enginesNode.trim())?.[1] : undefined
  const enginesVersion = enginesMin ? parseVersion(enginesMin) : undefined
  if (enginesVersion) {
    if (compareVersions(running, enginesVersion) < 0) {
      warnings.push(`o engines do package.json pede ${enginesNode}`)
    } else {
      notes.push(`engines: ${enginesNode}`)
    }
  }

  if (warnings.length > 0) {
    return { status: 'warn', label, message: `${shown}: ${warnings.join('; ')}.` }
  }
  return { status: 'ok', label, message: `${shown} (${notes.join('; ')}).` }
}

/** Mesma major e, no `.nvmrc` com minor ou patch, nunca abaixo do que ele pede. */
function isSameLine(running: Version, wanted: Version): boolean {
  return running.major === wanted.major && compareVersions(running, wanted) >= 0
}

// pnpm

function checkPnpm({ root, system }: DoctorInput, manifest: Json): Finding {
  const label = 'pnpm'
  const installedText = system.pnpmVersion()
  if (installedText === undefined) {
    return {
      status: 'error',
      label,
      message: 'o pnpm não foi encontrado. Instale com "corepack enable" ou "npm install -g pnpm".',
    }
  }
  const installed = parseVersion(installedText)
  if (!installed) {
    return { status: 'warn', label, message: `não entendi a versão '${installedText}'.` }
  }
  const shown = formatVersion(installed)

  const declared = asString(manifest.packageManager) ?? packageManagerUp(system, root)
  if (declared === undefined) {
    return {
      status: 'warn',
      label,
      message: `${shown}, mas o package.json não tem packageManager: fixe a versão com "pnpm@${shown}".`,
    }
  }
  const [name, spec = ''] = declared.split('@')
  const wanted = parseVersion(spec)
  if (name !== 'pnpm' || !wanted) {
    return {
      status: 'warn',
      label,
      message: `${shown}, mas o packageManager é '${declared}': o Prumo usa o pnpm.`,
    }
  }
  if (installed.major !== wanted.major || compareVersions(installed, wanted) < 0) {
    return {
      status: 'warn',
      label,
      message: `${shown}, mas o packageManager pede ${declared}: rode "corepack use ${declared}" ou instale essa versão.`,
    }
  }
  return { status: 'ok', label, message: `${shown} (packageManager: ${declared}).` }
}

/** O `packageManager` de um monorepo fica no `package.json` da raiz, acima do projeto. */
function packageManagerUp(system: DoctorSystem, root: string): string | undefined {
  for (let dir = path.dirname(root); ; dir = path.dirname(dir)) {
    const value = asString(readJson(system, path.join(dir, 'package.json'))?.packageManager)
    if (value !== undefined) return value
    if (path.dirname(dir) === dir) return undefined
  }
}

// Pacotes do Prumo

function declaredDependencies(manifest: Json): Set<string> {
  const names = new Set<string>()
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const value = manifest[field]
    if (typeof value === 'object' && value !== null) {
      for (const name of Object.keys(value)) names.add(name)
    }
  }
  return names
}

function expectedRange({ system }: DoctorInput, name: string): Range | undefined {
  if (name === CLI_PACKAGE_NAME) {
    const own = parseVersion(system.cliVersion)
    return own ? caretRange(own) : undefined
  }
  const text = PRUMO_PACKAGE_RANGES[name]
  return text ? parseRange(text) : undefined
}

function checkPackages(input: DoctorInput, manifest: Json): Finding[] {
  const declared = declaredDependencies(manifest)
  const findings: Finding[] = []
  for (const name of PRUMO_PACKAGES) {
    const installedManifest = readJson(
      input.system,
      path.join(input.root, 'node_modules', name, 'package.json'),
    )
    if (!installedManifest) {
      if (declared.has(name)) {
        findings.push({
          status: 'error',
          label: name,
          message: 'está no package.json, mas não está instalado: rode "pnpm install".',
        })
      }
      continue
    }
    findings.push(checkPackage(input, name, asString(installedManifest.version)))
  }
  if (findings.length === 0) {
    findings.push({
      status: 'warn',
      label: 'Pacotes do Prumo',
      message: 'nenhum pacote @matizze/prumo-* neste projeto.',
    })
  }
  return findings
}

function checkPackage(input: DoctorInput, name: string, versionText: string | undefined): Finding {
  const version = versionText ? parseVersion(versionText) : undefined
  if (!version) {
    return { status: 'warn', label: name, message: `não entendi a versão '${versionText ?? ''}'.` }
  }
  const shown = formatVersion(version)
  const range = expectedRange(input, name)
  if (!range) return { status: 'ok', label: name, message: `${shown}.` }

  const position = positionIn(version, range)
  const expected = formatRange(range)
  if (position === 'behind') {
    return {
      status: 'warn',
      label: name,
      message: `${shown} está atrás da faixa que esta CLI espera (${expected}): atualize o pacote.`,
    }
  }
  if (position === 'ahead') {
    return {
      status: 'warn',
      label: name,
      message: `${shown} está à frente da faixa que esta CLI espera (${expected}): atualize a CLI (${CLI_PACKAGE_NAME}).`,
    }
  }
  return { status: 'ok', label: name, message: `${shown} (esperado: ${expected}).` }
}

// Registry de UI

interface UiRegistry {
  name: string
  urlVariables: string[]
  tokenVariables: string[]
  /** A URL, quando o `components.json` a escreve direto, sem variável. */
  fixedUrl?: string
}

function findUiRegistry(registries: unknown): UiRegistry | undefined {
  if (typeof registries !== 'object' || registries === null) return undefined
  const names = Object.keys(registries).filter((name) => UI_REGISTRY_NAMESPACE.test(name))
  // `--ds <cliente>` troca o @mads pelo do cliente: se os dois estão lá, o do cliente é o que vale
  const name = names.find((candidate) => candidate !== MADS.namespace) ?? names[0]
  if (name === undefined) return undefined
  const config = (registries as Json)[name]
  const url = typeof config === 'string' ? config : asString((config as Json | null)?.url)
  const headers =
    typeof config === 'object' && config !== null ? (config as Json).headers : undefined
  const urlVariables = variablesIn(url)
  return {
    name,
    urlVariables,
    tokenVariables: variablesIn(headers),
    ...(urlVariables.length === 0 && url ? { fixedUrl: url } : {}),
  }
}

function checkRegistry(input: DoctorInput): Finding[] {
  const label = 'components.json'
  const file = path.join(input.root, 'components.json')
  const text = input.system.readText(file)
  if (text === undefined) {
    return [
      {
        status: 'error',
        label,
        message: 'não existe: o projeto precisa do components.json do shadcn.',
      },
    ]
  }
  const components = readJson(input.system, file)
  if (!components) {
    return [{ status: 'error', label, message: 'não é um JSON de objeto válido.' }]
  }

  const registry = findUiRegistry(components.registries)
  const findings: Finding[] = []
  if (registry) {
    findings.push({ status: 'ok', label, message: `registry de UI: ${registry.name}.` })
  } else {
    findings.push({
      status: 'warn',
      label,
      message:
        'sem registry de UI (@mads ou @<cliente>-ds) em "registries": o prumo add @mads/<item> não vai achar a UI.',
    })
  }

  const fileValues = parseEnvFile(input.system.readText(path.join(input.root, '.env.local')) ?? '')
  const lookup = (variable: string) => {
    if (input.env[variable]) return { value: input.env[variable], source: 'no ambiente' }
    if (fileValues[variable]) return { value: fileValues[variable], source: 'no .env.local' }
    return undefined
  }

  if (registry?.fixedUrl) {
    findings.push({
      status: 'ok',
      label: registry.name,
      message: `URL fixa: ${maskUrl(registry.fixedUrl)}.`,
    })
  }
  const urlVariables = registry ? registry.urlVariables : [DEFAULT_URL_VARIABLE]
  const tokenVariables = registry ? registry.tokenVariables : [DEFAULT_TOKEN_VARIABLE]

  for (const variable of unique(urlVariables)) {
    const found = lookup(variable)
    findings.push(
      found?.value
        ? { status: 'ok', label: variable, message: `${maskUrl(found.value)} (${found.source}).` }
        : {
            status: 'warn',
            label: variable,
            message: 'ausente: defina no ambiente ou no .env.local.',
          },
    )
  }
  // O valor do token nunca entra numa linha: só se ele existe e de onde vem
  for (const variable of unique(tokenVariables)) {
    const found = lookup(variable)
    findings.push(
      found
        ? { status: 'ok', label: variable, message: `definido (${found.source}).` }
        : {
            status: 'warn',
            label: variable,
            message: 'ausente: defina no ambiente ou no .env.local.',
          },
    )
  }
  return findings
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

/** Esconde usuário e senha de uma URL (`https://user:senha@host` vira `https://***@host`). */
function maskUrl(value: string): string {
  return value.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/i, '$1***@')
}

// Arquivos do projeto

function checkProjectFiles({ root, system }: DoctorInput): Finding[] {
  const findings: Finding[] = []
  for (const [name, hint] of [
    ['.mcp.json', 'a configuração do servidor MCP do shadcn'],
    ['.env.local', 'copie o .env.example e preencha o registry'],
  ] as const) {
    findings.push(
      system.readText(path.join(root, name)) === undefined
        ? { status: 'warn', label: name, message: `não existe (${hint}).` }
        : { status: 'ok', label: name, message: 'existe.' },
    )
  }
  return findings
}
