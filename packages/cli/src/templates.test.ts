import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { domainNames } from './codemod/index.ts'
import { APP_FILES } from './generate/app.ts'
import { COMPONENT_FILES } from './generate/component.ts'
import { DOMAIN_FILES } from './generate/domain.ts'
import {
  PAGE_DOMAIN_FILES,
  PAGE_FILES,
  messagesTemplate,
  MESSAGE_LANGUAGES,
} from './generate/page.ts'
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
  it('dá o kebab, o pascal, o camel e a constante de um nome', () => {
    expect(nameVars('plural', domainNames('pedidos-recentes', 'pedido-recente').plural)).toEqual({
      'plural.kebab': 'pedidos-recentes',
      'plural.pascal': 'PedidosRecentes',
      'plural.camel': 'pedidosRecentes',
      'plural.constant': 'PEDIDOS_RECENTES',
      'plural.title': 'Pedidos recentes',
    })
  })

  it('a constante é um identificador válido mesmo com número no nome', () => {
    expect(nameVars('singular', domainNames('error-404s', 'error-404').singular)).toMatchObject({
      'singular.constant': 'ERROR_404',
      'singular.pascal': 'Error404',
    })
  })
})

/** Cada modelo de cada gerador, com o caminho de destino (que também tem marcadores). */
const GENERATED: { template: string; to: string }[] = [
  ...APP_FILES,
  ...DOMAIN_FILES,
  ...PAGE_FILES,
  ...PAGE_DOMAIN_FILES,
  ...COMPONENT_FILES.map(({ template, name }) => ({ template, to: name })),
  ...MESSAGE_LANGUAGES.flatMap((language) =>
    [false, true].map((domain) => ({
      template: messagesTemplate(language, domain),
      to: `${language}.json`,
    })),
  ),
]

describe('os modelos', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name)).map((file) => `${entry.name}/${file}`)
        : [entry.name],
    )

  it('moram em templates/, na raiz do pacote, e o package.json os leva no tarball', () => {
    expect(TEMPLATES_DIR).toBe(path.resolve(import.meta.dirname, '../templates'))
    expect(existsSync(TEMPLATES_DIR)).toBe(true)
    const manifest = JSON.parse(
      readFileSync(path.join(TEMPLATES_DIR, '../package.json'), 'utf8'),
    ) as { files: string[] }
    expect(manifest.files).toEqual(['dist', 'templates'])
  })

  it('todo arquivo de templates/ é usado por um gerador, e todo modelo de um gerador existe', () => {
    const used = [...new Set(GENERATED.map((file) => file.template))]
    for (const template of used) expect(existsSync(path.join(TEMPLATES_DIR, template))).toBe(true)
    expect(files(TEMPLATES_DIR).sort()).toEqual([...used].sort())
  })

  it('só têm a extensão .tpl, para o TypeScript, o ESLint e o Vitest não os tomarem por código', () => {
    for (const file of files(TEMPLATES_DIR)) expect(file).toMatch(/\.tpl$/)
  })

  it('os marcadores dos modelos e dos caminhos são todos de nome (kebab, pascal, camel ou constant)', () => {
    const markers = new Set<string>()
    for (const { template, to } of GENERATED) {
      for (const text of [readTemplate(template), to]) {
        for (const match of text.matchAll(/\{\{([^}]*)\}\}/g)) markers.add(match[1] ?? '')
      }
    }
    for (const marker of markers)
      expect(marker).toMatch(
        /^(plural|singular|page|domain|component|app)\.(kebab|pascal|camel|constant|title)$/,
      )
  })

  it('renderizam sem sobrar marcador', () => {
    const names = domainNames('clientes')
    const vars = {
      ...nameVars('plural', names.plural),
      ...nameVars('singular', names.singular),
      ...nameVars('page', names.plural),
      ...nameVars('domain', names.plural),
      ...nameVars('component', names.plural),
      ...nameVars('app', names.plural),
      'app.title': 'Clientes',
    }
    for (const { template } of GENERATED) {
      const text = renderTemplateFile(template, vars)
      // O app tem `undefined` de verdade no código (resolveDataSource(undefined, ...))
      expect(text, template).not.toMatch(template.startsWith('app/') ? /\{\{/ : /\{\{|undefined/)
    }
  })
})
