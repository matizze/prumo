import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

/** O menu lateral: a ordem de leitura da documentação (tutorial, conceitos, guias e referência). */
const sidebars: SidebarsConfig = {
  docs: [
    { type: 'doc', id: 'README', label: 'Início' },
    { type: 'doc', id: 'getting-started', label: 'Primeiros passos' },
    {
      type: 'category',
      label: 'Conceitos',
      collapsed: false,
      items: [
        { type: 'doc', id: 'concepts/architecture', label: 'Arquitetura' },
        { type: 'doc', id: 'concepts/generated-app', label: 'Anatomia do app gerado' },
      ],
    },
    {
      type: 'category',
      label: 'Guias',
      collapsed: false,
      items: [
        { type: 'doc', id: 'guides/pages', label: 'Telas' },
        { type: 'doc', id: 'guides/domains', label: 'Domínios de dados' },
        { type: 'doc', id: 'guides/real-api', label: 'Ligar uma API real' },
        { type: 'doc', id: 'guides/i18n', label: 'Textos e idiomas' },
        { type: 'doc', id: 'guides/errors-and-notifications', label: 'Erros e notificações' },
        { type: 'doc', id: 'guides/test', label: 'Testes' },
        { type: 'doc', id: 'guides/design-system', label: 'Design system' },
        { type: 'doc', id: 'guides/ai-agents', label: 'Agentes de IA' },
        { type: 'doc', id: 'guides/existing-project', label: 'Projeto existente' },
      ],
    },
    {
      type: 'category',
      label: 'Referência',
      collapsed: false,
      items: [
        { type: 'doc', id: 'reference/cli', label: 'CLI' },
        { type: 'doc', id: 'reference/core', label: 'core' },
        { type: 'doc', id: 'reference/rules', label: 'rules' },
        { type: 'doc', id: 'reference/testing', label: 'testing' },
        { type: 'doc', id: 'reference/mcp', label: 'MCP' },
      ],
    },
    { type: 'doc', id: 'faq', label: 'Perguntas frequentes' },
    {
      type: 'category',
      label: 'Contribuindo',
      items: [{ type: 'doc', id: 'contributing/internals', label: 'Por dentro' }],
    },
  ],
}

export default sidebars
