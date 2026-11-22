import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { UsageError } from '../errors.ts'

/** O escopo dos pacotes do Prumo, os que o produto novo instala dos tarballs de `--packages`. */
const PRUMO_SCOPE = '@matizze/prumo-'

/**
 * A versão de cada pacote de `packages/*` da origem (`@matizze/prumo-core` -> `0.1.0`). É dela que
 * sai a faixa que substitui o `workspace:*` no `package.json` do produto.
 */
export function readOriginVersions(originRoot: string): Map<string, string> {
  const versions = new Map<string, string>()
  const packagesDir = path.join(originRoot, 'packages')
  if (!existsSync(packagesDir)) return versions
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(packagesDir, entry.name, 'package.json')
    if (!existsSync(file)) continue
    const { name, version } = JSON.parse(readFileSync(file, 'utf8')) as {
      name?: string
      version?: string
    }
    if (name && version) versions.set(name, version)
  }
  return versions
}

/** O nome e a versão do pacote dentro de um tarball, lidos com o `tar` do sistema. */
function readTarball(file: string): { name: string; version: string } {
  const result = spawnSync('tar', ['-xOzf', file, 'package/package.json'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    throw new UsageError(
      `não consegui ler o package.json de '${file}' (--packages): ${result.error?.message ?? result.stderr.trim()}`,
    )
  }
  const { name, version } = JSON.parse(result.stdout) as { name?: string; version?: string }
  if (!name || !version) {
    throw new UsageError(`o tarball '${file}' não tem nome e versão no package.json (--packages).`)
  }
  return { name, version }
}

/**
 * Os tarballs `.tgz` de `@matizze/prumo-*` de uma pasta (a que o `pnpm pack:all` gera), como um
 * mapa de nome do pacote para o `file:` do caminho absoluto. Um tarball de outro pacote é ignorado.
 * Pasta que não existe, ou sem tarball do Prumo, é erro de uso.
 */
export function readTarballs(dir: string): Record<string, string> {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new UsageError(`a pasta '${dir}' não existe (--packages).`)
  }
  const tarballs: Record<string, string> = {}
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith('.tgz')) continue
    const file = path.join(dir, entry)
    const { name } = readTarball(file)
    if (name.startsWith(PRUMO_SCOPE)) tarballs[name] = `file:${file}`
  }
  if (Object.keys(tarballs).length === 0) {
    throw new UsageError(
      `a pasta '${dir}' não tem tarball de ${PRUMO_SCOPE}* (--packages). Gere-os com pnpm pack:all, no monorepo do Prumo.`,
    )
  }
  return tarballs
}

/**
 * Confere que cada pacote do Prumo de que o produto depende (os `workspace:` do starter) tem tarball
 * na pasta. O que falta é erro de uso, antes de escrever qualquer coisa.
 */
export function assertTarballsCover(
  packageJsonText: string,
  tarballs: Readonly<Record<string, string>>,
): void {
  const data = JSON.parse(packageJsonText) as Record<string, Record<string, string> | undefined>
  const needed = new Set<string>()
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const [name, spec] of Object.entries(data[section] ?? {})) {
      if (spec.startsWith('workspace:') && name.startsWith(PRUMO_SCOPE)) needed.add(name)
    }
  }
  const missing = [...needed].filter((name) => !(name in tarballs)).sort()
  if (missing.length > 0) {
    throw new UsageError(
      `a pasta de --packages não tem o tarball de ${missing.join(', ')}. Gere-os com pnpm pack:all, no monorepo do Prumo.`,
    )
  }
}
