# Prumo

Ferramenta da Matizze para criar e manter aplicações React organizadas em camadas: telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas e as regras que mantêm a arquitetura. O Prumo gera a estrutura e confere a arquitetura; **não traz frontend** (nenhum componente de interface, ícone, tema, CSS ou Storybook). A interface é do produto.

O plano está em [docs/plano.md](docs/plano.md).

## Situação

**Em transição (22/11/2026).** O repositório ainda tem o app de referência, o catálogo e o starter das fases anteriores, que levaram o Prumo para o lado de um frontend completo. Eles saem na Fase A do plano, e os geradores voltam simples na Fase B. Nada foi publicado.

## Pacotes

| Pacote                                       | O que entrega                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`@matizze/prumo-core`](packages/core)       | Container de repositórios, query keys, tipo `Page`, utilitários de mock, i18n, erros, guarda de login e provedor de query |
| [`@matizze/prumo-rules`](packages/rules)     | Regras da arquitetura: plugin de ESLint e a análise do `prumo check`                                                      |
| [`@matizze/prumo-testing`](packages/testing) | Render com provedores e teste de contrato                                                                                 |
| [`@matizze/prumo-cli`](packages/cli)         | O comando `prumo`                                                                                                         |
| [`@matizze/prumo-mcp`](packages/mcp)         | Servidor MCP com os comandos da CLI, para agentes                                                                         |

## Comandos do monorepo

```bash
pnpm install
pnpm verify:packages   # typecheck, lint e testes dos pacotes
```

Requisitos: Node 24 e pnpm 10.
