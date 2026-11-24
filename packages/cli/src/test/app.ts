import { readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { beforeAll } from 'vitest'
import { generateApp } from '../generators/app.ts'
import { makeDir } from './fs.ts'

let cached: Readonly<Record<string, string>> | undefined

/**
 * Os arquivos do app que o `prumo new` gera (caminho relativo, com `/`, para o texto), montados
 * pelo próprio `generateApp` a partir dos modelos em `templates/`: nenhum texto de modelo é
 * copiado à mão nos testes, então um modelo que muda muda o fixture junto. O plano vai para uma
 * pasta temporária (sem `pnpm install`, `git init` nem rede) e é lido de volta uma vez por arquivo
 * de teste.
 */
export function generatedApp(): Readonly<Record<string, string>> {
  if (cached) return cached
  const dir = makeDir()
  const root = path.join(dir, 'app')
  try {
    generateApp({ root, name: 'app' }).commit()
    cached = Object.fromEntries(
      readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const file = path.join(entry.parentPath, entry.name)
          return [path.relative(root, file).split(path.sep).join('/'), readFileSync(file, 'utf8')]
        }),
    )
    return cached
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// Gera o app antes do primeiro teste do arquivo: o custo não cai no tempo limite de um teste
beforeAll(() => {
  generatedApp()
}, 60_000)

/**
 * Troca `from` por `to` no texto de um arquivo gerado. Falha se o trecho não está lá: um modelo
 * que mudou aparece como erro aqui, em vez de o ajuste do teste virar um no-op calado.
 */
export function patchText(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`O trecho não está no arquivo gerado: ${from}`)
  return text.replace(from, to)
}
