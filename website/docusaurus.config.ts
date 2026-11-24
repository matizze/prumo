import path from 'node:path'
import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { linkOutsideDocs } from './src/remark/link-outside-docs'

/**
 * O site da documentação do Prumo: publica a pasta docs/ do repositório, a mesma que se lê no
 * GitHub, sem cópia. A imagem é gerada pelo GitHub Actions (.github/workflows/docs.yml).
 */
const repository = 'https://github.com/matizze/prumo'
const docsDir = path.resolve(__dirname, '../docs')

const config: Config = {
  title: 'Prumo',
  tagline: 'Cria e mantém apps React organizados em camadas e confere a arquitetura.',
  url: 'https://docs.prumo.matizze.com.br',
  baseUrl: '/',
  favicon: 'img/favicon.svg',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  i18n: { defaultLocale: 'pt-BR', locales: ['pt-BR'] },
  markdown: {
    // .md é Markdown comum (CommonMark), não MDX: o texto pode ter <nome> e {chaves}
    format: 'detect',
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'throw' },
  },
  themes: ['@docusaurus/theme-mermaid'],
  plugins: [
    // O tema mermaid importa o layout ELK, um pacote opcional e pesado que o site não usa; com o
    // pnpm, o webpack não acha o módulo e o build falha. O alias para false o troca por um vazio.
    () => ({
      name: 'mermaid-without-elk',
      configureWebpack: () => ({ resolve: { alias: { '@mermaid-js/layout-elk': false } } }),
    }),
  ],
  presets: [
    [
      'classic',
      {
        docs: {
          path: docsDir,
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: ({ docPath }) => `${repository}/edit/main/docs/${docPath}`,
          beforeDefaultRemarkPlugins: [linkOutsideDocs({ docsDir, repository })],
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'Prumo',
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Documentação', position: 'left' },
        { to: '/getting-started', label: 'Primeiros passos', position: 'left' },
        { to: '/reference/cli', label: 'CLI', position: 'left' },
        { href: 'https://www.npmjs.com/package/@matizze/prumo-cli', label: 'npm', position: 'right' },
        { href: repository, label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentação',
          items: [
            { label: 'Primeiros passos', to: '/getting-started' },
            { label: 'Arquitetura', to: '/concepts/architecture' },
            { label: 'Referência da CLI', to: '/reference/cli' },
          ],
        },
        {
          title: 'Pacotes',
          items: [
            { label: '@matizze/prumo-cli', href: 'https://www.npmjs.com/package/@matizze/prumo-cli' },
            { label: '@matizze/prumo-core', href: 'https://www.npmjs.com/package/@matizze/prumo-core' },
          ],
        },
        {
          title: 'Projeto',
          items: [
            { label: 'GitHub', href: repository },
            { label: 'Como contribuir', href: `${repository}/blob/main/CONTRIBUTING.md` },
            { label: 'Segurança', href: `${repository}/blob/main/SECURITY.md` },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Matizze`,
    },
    prism: { additionalLanguages: ['bash', 'json'] },
    mermaid: { theme: { light: 'neutral', dark: 'dark' } },
  } satisfies Preset.ThemeConfig,
}

export default config
