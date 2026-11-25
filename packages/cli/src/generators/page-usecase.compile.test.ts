import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { project, tsc, vitest } from '../test/compile.ts'
import { exec } from '../test/run.ts'

/**
 * As telas de use case geradas de verdade: o projeto temporário de `test/compile.ts` recebe os use
 * cases (o CRUD de livros, a leitura de uma lista em array, entrar, sair e um local) e uma tela de
 * cada tipo (lista, detalhe e formulário). O `tsc` estrito compila tudo e o teste que cada tela traz
 * roda contra o mock.
 */
const USE_CASES = [
  ['livros', '--crud'],
  ['clientes.get-clientes', '--output', 'cliente[]'],
  ['auth.sign-in', '--input', 'email:string,password:string', '--output', 'token:string'],
  ['auth.sign-out'],
  ['cart.add-item', '--local', '--input', 'productId:string,quantity:int'],
] as const

const PAGES = [
  ['livros', '--usecase', 'livros.list-livros'],
  ['livro', '--usecase', 'livros.get-livro', '--path', '/livros/:id'],
  ['livro-novo', '--usecase', 'livros.create-livro'],
  ['clientes', '--usecase', 'clientes.get-clientes'],
  ['auth.login', '--usecase', 'auth.sign-in'],
  ['auth.logout', '--usecase', 'auth.sign-out'],
  ['carrinho', '--usecase', 'cart.add-item'],
] as const

let root: string
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

beforeAll(async () => {
  root = await project('nome:string')
  const prumo = async (...args: string[]) => {
    const made = await exec(args, root)
    expect(made.code, `${args.join(' ')}\n${made.stdout}${made.stderr}`).toBe(0)
  }
  await prumo(
    'make:schema',
    'livros',
    '--fields',
    'titulo:string,ano:number,situacao:enum(lido|lendo),lidoEm?:datetime,nota?:int,disponivel:boolean',
  )
  for (const args of USE_CASES) await prumo(...(args[0] === 'livros' ? ['make:usecase', ...args] : ['make:usecase', ...args]))
  for (const args of PAGES) await prumo('make:page', ...args)
}, 240_000)

describe('as telas de use case geradas compilam (tsc estrito) e passam nos próprios testes', () => {
  it('cada tela usa o use case pela chave, com useQuery ou useMutation', () => {
    expect(read('src/pages/livros/model.ts')).toContain('const { listLivros } = useUseCases()')
    expect(read('src/pages/livros/model.ts')).toContain('queryKey: listLivrosKey(input)')
    expect(read('src/pages/livro/model.ts')).toContain('const { id } = useParams<{ id: string }>()')
    expect(read('src/pages/auth/login/model.ts')).toContain("onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] })")
    expect(read('src/pages/livro-novo/view.tsx')).toContain('<select id="situacao" name="situacao" required>')
  })

  it('compilam com o tsc, no modo estrito do projeto', () => {
    expect(tsc(root)).toEqual({ status: 0, output: '' })
  }, 180_000)

  it('cada tela passa no teste que traz', () => {
    const tests = vitest(root, {}, ['src/pages'])
    expect(tests.status, tests.output).toBe(0)
    for (const page of ['livros', 'livro', 'livro-novo', 'clientes', 'auth/login', 'auth/logout', 'carrinho']) {
      expect(tests.output).toContain(`src/pages/${page}/index.test.tsx`)
    }
  }, 180_000)
})
