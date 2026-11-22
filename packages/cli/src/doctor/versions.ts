/** Uma versão `major.minor.patch`, sem pré-lançamento nem metadados (que o `doctor` ignora). */
export interface Version {
  major: number
  minor: number
  patch: number
}

/**
 * Lê `1.2.3`, `v1.2.3`, `24` ou `24.1` (o que falta vira 0). Devolve `undefined` para o que não é
 * versão (`lts/*`, `latest`, vazio). O que vem depois do patch (`-beta.1`, `+sha`) é descartado.
 */
export function parseVersion(text: string): Version | undefined {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(text.trim())
  if (!match) return undefined
  return { major: Number(match[1]), minor: Number(match[2] ?? 0), patch: Number(match[3] ?? 0) }
}

/** Negativo se `a < b`, zero se iguais, positivo se `a > b`. */
export function compareVersions(a: Version, b: Version): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export function formatVersion({ major, minor, patch }: Version): string {
  return `${major}.${minor}.${patch}`
}

/**
 * Uma faixa compatível: do mínimo (inclusive) até o limite (exclusive). É o que a CLI diz esperar
 * de cada pacote: `>=0.1.0 <0.2.0`.
 */
export interface Range {
  min: Version
  below: Version
}

/** Lê uma faixa no formato `>=0.1.0 <0.2.0`; `undefined` se o texto é de outro formato. */
export function parseRange(text: string): Range | undefined {
  const match = /^>=\s*(\S+)\s+<\s*(\S+)$/.exec(text.trim())
  const min = match?.[1] ? parseVersion(match[1]) : undefined
  const below = match?.[2] ? parseVersion(match[2]) : undefined
  return min && below ? { min, below } : undefined
}

/**
 * A faixa que o `^` do npm daria: da versão até a próxima linha de compatibilidade. Antes da 1.0,
 * a linha é a minor (`0.2.0` vai até `0.3.0`); a partir da 1.0, a major. Serve à própria CLI, que
 * espera a linha da versão que ela tem.
 */
export function caretRange(version: Version): Range {
  const below =
    version.major === 0
      ? { major: 0, minor: version.minor + 1, patch: 0 }
      : { major: version.major + 1, minor: 0, patch: 0 }
  return { min: version, below }
}

/** Onde a versão fica em relação à faixa: abaixo do mínimo, dentro ou a partir do limite. */
export function positionIn(version: Version, range: Range): 'behind' | 'inside' | 'ahead' {
  if (compareVersions(version, range.min) < 0) return 'behind'
  return compareVersions(version, range.below) >= 0 ? 'ahead' : 'inside'
}

export function formatRange({ min, below }: Range): string {
  return `>=${formatVersion(min)} <${formatVersion(below)}`
}
