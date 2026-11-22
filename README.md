# Prumo

Ferramenta da Matizze para criar e manter aplicações React organizadas em camadas: telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas e as regras que mantêm a arquitetura. O Prumo gera a estrutura e confere a arquitetura; **não traz frontend** (nenhum componente de interface, ícone, tema, CSS ou Storybook). A interface é do produto.

O plano está em [docs/plano.md](docs/plano.md).

## Situação

**Fases A e B do plano concluídas.** O Prumo não traz frontend, e os geradores simples estão prontos: a CLI tem `new`, `make:page`, `make:domain`, `make:component`, `check` e `doctor`, os modelos moram no `@matizze/prumo-cli`, e o servidor MCP expõe as mesmas ferramentas. O portão local, `pnpm verify:new`, cria um app numa pasta temporária, gera tela, domínio e componente pela CLI e pelo MCP e roda a verificação nele, em menos de um minuto e sem navegador. A Fase C, a publicação no npm público, depende de uma pessoa (a organização `matizze` no npmjs e um token). Nada foi publicado.

## Pacotes

| Pacote                                       | O que entrega                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`@matizze/prumo-core`](packages/core)       | Container de repositórios, query keys, tipo `Page`, utilitários de mock, i18n, erros, guarda de login e provedor de query |
| [`@matizze/prumo-rules`](packages/rules)     | Regras da arquitetura: plugin de ESLint (`page-structure`, `no-cross-page-import`) e a análise do `prumo check`           |
| [`@matizze/prumo-testing`](packages/testing) | Render com provedores, setup do DOM e teste de contrato de repositório, sem interface                                     |
| [`@matizze/prumo-cli`](packages/cli)         | O comando `prumo` (`new`, `make:page`, `make:domain`, `make:component`, `check` e `doctor`)                               |
| [`@matizze/prumo-mcp`](packages/mcp)         | Servidor MCP com os comandos da CLI, para agentes                                                                         |

## Comandos do monorepo

```bash
pnpm install
pnpm verify            # typecheck, lint e testes dos pacotes
pnpm verify:new        # o portão: cria um app novo, gera tela, domínio e componente (CLI e MCP) e roda o verify dele
```

Requisitos: Node 24 e pnpm 10.
