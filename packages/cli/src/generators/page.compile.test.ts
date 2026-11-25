import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { project, tsc, vitest } from '../test/compile.ts'
import { exec } from '../test/run.ts'

/**
 * As telas geradas de verdade: o projeto temporário de `test/compile.ts` (o app que o `prumo new`
 * gera, com o i18n, o `App.tsx` e o `renderWithProviders`) recebe um domínio com dígito no nome da
 * entidade (schema e use cases pelos comandos) e três variações de tela: só o título, a rota com
 * parâmetro e o detalhe de um use case. O `tsc` estrito compila tudo e o teste que cada tela traz
 * roda contra o mock.
 */
const PAGES = [
  ['sobre'],
  ['perfil', '--path', '/perfil/:usuario'],
  ['fase', '--usecase', 'fases-2.get-fase-2', '--path', '/fases/:id'],
] as const

let root: string

beforeAll(async () => {
  root = await project('nome:string')
  const prumo = async (...args: string[]) => {
    const made = await exec(args, root)
    expect(made.code, `${args.join(' ')}\n${made.stdout}${made.stderr}`).toBe(0)
    return made
  }
  // Um domínio com dígito no nome da entidade (fase-2): o arquivo do schema e o id vêm dos arquivos
  await prumo('make:schema', 'fases-2', '--entity', 'fase-2', '--fields', 'titulo:string')
  await prumo('make:usecase', 'fases-2', '--entity', 'fase-2', '--crud')
  for (const args of PAGES) await prumo('make:page', ...args)
}, 120_000)

describe('as telas geradas compilam (tsc estrito) e passam nos próprios testes', () => {
  it('registram as rotas e os namespaces, em ordem, nos dois idiomas', () => {
    const app = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    for (const route of ['/sobre', '/perfil/:usuario', '/fases/:id']) {
      expect(app).toContain(`<Route path="${route}">`)
    }
    for (const language of ['en', 'pt-BR']) {
      const index = readFileSync(path.join(root, `src/messages/${language}/index.ts`), 'utf8')
      expect(index).toContain('  errors,\n  fase,\n  home,\n  perfil,\n  sobre,\n')
    }
  })

  it('as variações: o que cada model usa', () => {
    const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
    expect(read('src/pages/sobre/model.ts')).not.toContain('useUseCases')
    expect(read('src/pages/perfil/model.ts')).toContain('useParams<{ usuario: string }>()')
    expect(read('src/pages/fase/model.ts')).toContain('getFase2')
    expect(read('src/pages/fase/view.tsx')).toContain('m.item.titulo')
  })

  it('compilam com o tsc, no modo estrito do projeto', () => {
    expect(tsc(root)).toEqual({ status: 0, output: '' })
  }, 180_000)

  it('cada tela passa no teste que traz', () => {
    const tests = vitest(root, {}, ['src/pages'])
    expect(tests.status, tests.output).toBe(0)
    for (const page of ['sobre', 'perfil', 'fase']) {
      expect(tests.output).toContain(`src/pages/${page}/index.test.tsx`)
    }
  }, 180_000)

  it('o tsc de fato confere: um campo que não existe na tela gerada seria pego', () => {
    const file = path.join(root, 'src/pages/fase/view.tsx')
    const original = readFileSync(file, 'utf8')
    writeFileSync(file, original.replace('m.item.titulo', 'm.item.nome'))
    try {
      const result = tsc(root)
      expect(result.status).not.toBe(0)
      expect(result.output).toContain('src/pages/fase/view.tsx')
    } finally {
      writeFileSync(file, original)
    }
  }, 180_000)
})
