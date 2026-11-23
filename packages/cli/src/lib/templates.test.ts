import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_FILES } from '../generators/app.ts'
import { MESSAGE_LANGUAGES, PAGE_FILES } from '../generators/page.ts'
import { REPOSITORY_FILES } from '../generators/repository.ts'
import { SCHEMA_FILE } from '../generators/schema.ts'
import { deriveNames } from './names.ts'
import {
  nameVars,
  readTemplate,
  renderTemplate,
  renderTemplateFile,
  TEMPLATES_DIR,
} from './templates.ts'

describe('renderTemplate', () => {
  it('troca cada marcador pelo valor, inclusive os repetidos', () => {
    expect(
      renderTemplate('{{a.kebab}} e {{a.pascal}}, de novo {{a.kebab}}', {
        'a.kebab': 'pedidos',
        'a.pascal': 'Pedidos',
      }),
    ).toBe('pedidos e Pedidos, de novo pedidos')
  })

  it('não toca no que não é marcador, como as chaves duplas de um JSX', () => {
    const text = "<div style={{ color: 'red' }} data-x={{a: 1}}>{`${x}`}</div> {{ a.b }} {{}}"
    expect(renderTemplate(text, { 'a.b': 'valor' })).toBe(text)
  })

  it('lança no marcador sem valor, em vez de escrever undefined no código de alguém', () => {
    expect(() => renderTemplate('{{plural.kebab}} {{outro}}', { 'plural.kebab': 'x' })).toThrow(
      'o modelo usa o marcador {{outro}}, que não tem valor.',
    )
  })

  it('não trata o valor como marcador (nada é trocado duas vezes)', () => {
    expect(renderTemplate('{{a}}', { a: '{{b}}', b: 'x' })).toBe('{{b}}')
  })
})

describe('nameVars', () => {
  it('dá o kebab, o pascal, o camel, a constante e o título de um nome', () => {
    expect(nameVars('page', deriveNames('pedidos-recentes'))).toEqual({
      'page.kebab': 'pedidos-recentes',
      'page.pascal': 'PedidosRecentes',
      'page.camel': 'pedidosRecentes',
      'page.constant': 'PEDIDOS_RECENTES',
      'page.title': 'Pedidos recentes',
    })
  })

  it('a constante é um identificador válido mesmo com número no nome', () => {
    expect(nameVars('page', deriveNames('error-404'))).toMatchObject({
      'page.constant': 'ERROR_404',
      'page.pascal': 'Error404',
    })
  })
})

/** Cada modelo que um gerador já usa, com o caminho de destino (que também tem marcadores). */
const GENERATED: { template: string; to: string }[] = [
  ...APP_FILES,
  ...PAGE_FILES,
  SCHEMA_FILE,
  ...REPOSITORY_FILES,
  ...MESSAGE_LANGUAGES.map((language) => ({
    template: `page/messages.${language}.json.tpl`,
    to: `${language}.json`,
  })),
]

/**
 * Os modelos que ainda esperam o gerador dos passos seguintes da reescrita (a query e as outras variações da tela). Cada passo tira o seu daqui ao ligar o modelo.
 */
const WAITING = [/^domain\/queries/, /^page\/(index|model|view)-(domain|param|detail)/, /^page\/messages-domain/]

describe('os modelos', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name)).map((file) => `${entry.name}/${file}`)
        : [entry.name],
    )

  it('moram em templates/, na raiz do pacote, e o package.json os leva no tarball', () => {
    expect(TEMPLATES_DIR).toBe(path.resolve(import.meta.dirname, '../../templates'))
    expect(existsSync(TEMPLATES_DIR)).toBe(true)
    const manifest = JSON.parse(
      readFileSync(path.join(TEMPLATES_DIR, '../package.json'), 'utf8'),
    ) as { files: string[] }
    expect(manifest.files).toEqual(['dist', 'templates'])
  })

  it('todo modelo de um gerador existe, e todo arquivo de templates/ é usado ou espera um passo', () => {
    const used = new Set(GENERATED.map((file) => file.template))
    for (const template of used) expect(existsSync(path.join(TEMPLATES_DIR, template))).toBe(true)
    const unused = files(TEMPLATES_DIR).filter((file) => !used.has(file))
    for (const file of unused) {
      expect(
        WAITING.some((pattern) => pattern.test(file)),
        `${file} não é usado por nenhum gerador`,
      ).toBe(true)
    }
  })

  it('só têm a extensão .tpl, para o TypeScript, o ESLint e o Vitest não os tomarem por código', () => {
    for (const file of files(TEMPLATES_DIR)) expect(file).toMatch(/\.tpl$/)
  })

  it('os marcadores dos modelos e dos caminhos são todos de nome (kebab, pascal, camel ou constant) ou da rota', () => {
    const markers = new Set<string>()
    for (const { template, to } of GENERATED) {
      for (const text of [readTemplate(template), to]) {
        for (const match of text.matchAll(/\{\{([^}]*)\}\}/g)) markers.add(match[1] ?? '')
      }
    }
    for (const marker of markers)
      expect(marker).toMatch(
        /^((plural|singular|page|domain|app)\.(kebab|pascal|camel|constant|title)|route\.(path|example)|param\.(name|example)|detail\.hook|field\.(name|sample)|fields\.[A-Za-z]+|test\.[A-Za-z]+)$/,
      )
  })

  it('renderizam sem sobrar marcador', () => {
    const names = deriveNames('clientes')
    const vars = {
      ...nameVars('page', names),
      ...nameVars('app', names),
      'app.title': 'Clientes',
      'route.path': '/clientes',
    }
    // O schema e o repositório dependem dos campos: os testes dos geradores os renderizam
    const needsFields = (template: string) =>
      template === SCHEMA_FILE.template || REPOSITORY_FILES.some((file) => file.template === template)
    for (const { template } of GENERATED.filter(({ template }) => !needsFields(template))) {
      const text = renderTemplateFile(template, vars)
      // O app tem `undefined` de verdade no código (resolveDataSource(undefined, ...))
      expect(text, template).not.toMatch(template.startsWith('app/') ? /\{\{/ : /\{\{|undefined/)
    }
  })
})
