import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { UsageError } from '../errors.ts'
import { PRUMO_VERSIONS } from './versions.ts'

/** O nome e a versão do pacote dentro de um tarball, lidos com o `tar` do sistema. */
function readTarballName(file: string): string {
  const result = spawnSync('tar', ['-xOzf', file, 'package/package.json'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    throw new UsageError(
      `não consegui ler o package.json de '${file}' (--packages): ${result.error?.message ?? result.stderr.trim()}`,
    )
  }
  const { name } = JSON.parse(result.stdout) as { name?: string }
  if (!name) throw new UsageError(`o tarball '${file}' não tem nome no package.json (--packages).`)
  return name
}

/**
 * Os tarballs `.tgz` dos pacotes do Prumo de uma pasta (a que o `pnpm pack:all` gera), como um mapa
 * de nome do pacote para o `file:` do caminho absoluto. Um tarball de outro pacote é ignorado. Pasta
 * que não existe, ou sem o tarball de algum dos pacotes que o app instala, é erro de uso.
 */
export function readTarballs(dir: string): Record<string, string> {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new UsageError(`a pasta '${dir}' não existe (--packages).`)
  }
  const tarballs: Record<string, string> = {}
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith('.tgz')) continue
    const file = path.join(dir, entry)
    const name = readTarballName(file)
    if (name in PRUMO_VERSIONS) tarballs[name] = `file:${file}`
  }
  const missing = Object.keys(PRUMO_VERSIONS).filter((name) => !(name in tarballs))
  if (missing.length > 0) {
    throw new UsageError(
      `a pasta '${dir}' não tem o tarball de ${missing.join(', ')} (--packages). Gere-os com pnpm pack:all, no monorepo do Prumo.`,
    )
  }
  return tarballs
}
