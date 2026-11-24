import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../test/fixture-project.ts'
import { exec } from '../test/run.ts'

const read = (root: string, file: string) => readFileSync(path.join(root, file), 'utf8')

/** Um projeto de fixture com o schema `stores` e o `errors.json` de cada idioma. */
async function withStores() {
  const { root } = fixtureProject()
  const made = await exec(['make:schema', 'stores', '--fields', 'name:string'], root)
  expect(made.code, made.stderr).toBe(0)
  writeFileSync(path.join(root, 'src/messages/pt-BR/errors.json'), '{}\n')
  writeFileSync(path.join(root, 'src/messages/en/errors.json'), '{}\n')
  return root
}

describe('prumo make:usecase', () => {
  it('cria o use case, registra e diz o próximo passo', async () => {
    const root = await withStores()
    const result = await exec(['make:usecase', 'stores.get-stores', '--output', 'store[]'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('prumo make:usecase: stores.get-stores (leitura, GET /stores/get-stores).')
    expect(result.stdout).toContain('Criados (5):\n  src/use-cases/stores/get-stores.mock.ts')
    expect(result.stdout).toContain(
      'Alterados (3):\n  src/messages/en/errors.json\n  src/messages/pt-BR/errors.json\n  src/use-cases/index.ts',
    )
    expect(result.stdout).toContain('Aviso: sem --input, o Input é um objeto vazio')
    expect(result.stdout).not.toContain('sem --output')
    expect(result.stdout).toContain(
      'Próximo passo: no model da tela, const { getStores } = useUseCases() e useQuery({ queryKey: getStoresKey(input), queryFn: () => getStores.execute(input) }).\n',
    )
    expect(read(root, 'src/use-cases/index.ts')).toContain('...createStoresUseCases(deps),')
    expect(JSON.parse(read(root, 'src/messages/en/errors.json'))).toEqual({ GET_STORES_FAILED: 'Could not load the data.' })
  })

  it('escrita: o próximo passo é o useMutation', async () => {
    const root = await withStores()
    const result = await exec(
      ['make:usecase', 'auth/sign-in', '--input', 'email:string,password:string', '--output', 'token:string'],
      root,
    )
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('auth.sign-in (escrita, POST /auth/sign-in).')
    expect(result.stdout).not.toContain('Aviso')
    expect(result.stdout).toContain('useMutation({ mutationFn: (input) => signIn.execute(input) })')
  })

  it('--local: tipo local, sem endpoint e sem mock', async () => {
    const root = await withStores()
    const result = await exec(['make:usecase', 'cart.add-item', '--local', '--input', 'productId:string'], root)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('cart.add-item (local).')
    expect(existsSync(path.join(root, 'src/use-cases/cart/add-item.mock.ts'))).toBe(false)
    expect(result.stdout).not.toContain('errors.json')
  })

  it('--dry-run lista o plano e não escreve nada', async () => {
    const root = await withStores()
    const result = await exec(['make:usecase', 'stores.get-stores', '--dry-run'], root)

    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('(simulação)')
    expect(result.stdout).toContain('Seriam criados (5):')
    expect(result.stdout).toContain('Seriam alterados (3):')
    expect(result.stdout).toContain('Simulação (--dry-run): nada foi escrito.')
    expect(result.stdout).not.toContain('Próximo passo')
    expect(existsSync(path.join(root, 'src/use-cases/stores'))).toBe(false)
  })

  it('a mesma ação duas vezes, e a chave de outro domínio: saída 2 e nada muda', async () => {
    const root = await withStores()
    expect((await exec(['make:usecase', 'stores.get-stores'], root)).code).toBe(0)
    const registry = read(root, 'src/use-cases/index.ts')

    const again = await exec(['make:usecase', 'stores.get-stores'], root)
    expect(again.code).toBe(2)
    expect(again.stderr).toContain("o use case 'stores.get-stores' já existe")
    const clash = await exec(['make:usecase', 'orders.get-stores'], root)
    expect(clash.code).toBe(2)
    expect(clash.stderr).toContain("a chave 'getStores' do registro já é do use case 'stores.get-stores'")
    expect(existsSync(path.join(root, 'src/use-cases/orders'))).toBe(false)
    expect(read(root, 'src/use-cases/index.ts')).toBe(registry)
  })

  it('recusa os usos errados com 2, sem criar nada', async () => {
    const root = await withStores()
    for (const args of [
      ['make:usecase'],
      ['make:usecase', 'stores'],
      ['make:usecase', 'stores.get-stores', '--read', '--write'],
      ['make:usecase', 'stores.get-stores', '--local', '--endpoint', 'GET /x'],
      ['make:usecase', 'stores.get-stores', '--input', ' '],
      ['make:usecase', 'stores.get-stores', '--endpoint', 'FETCH /x'],
      ['make:usecase', 'stores.get-stores', '--output', 'loja'],
      ['make:usecase', 'stores.get-stores', '--root', ''],
      ['make:usecase', 'stores.get-stores', '--nada'],
    ]) {
      const result = await exec(args, root)
      expect(result.code, args.join(' ')).toBe(2)
      expect(result.stdout).toBe('')
    }
    expect(existsSync(path.join(root, 'src/use-cases/stores'))).toBe(false)
  })

  it('--root aponta para o projeto', async () => {
    const root = await withStores()
    const result = await exec(['make:usecase', 'stores.get-stores', '--root', root], path.dirname(root))
    expect(result.code, result.stderr).toBe(0)
    expect(existsSync(path.join(root, 'src/use-cases/stores/index.ts'))).toBe(true)
  })

  it('a ajuda traz os exemplos e a referência', async () => {
    const { root } = fixtureProject()
    const help = await exec(['make:usecase', '--help'], root)
    expect(help.stdout).toContain('prumo make:usecase auth.sign-in --input "email:string,password:string" --output "token:string"')
    expect(help.stdout).toContain('reference/cli#prumo-makeusecase')
  })
})
