# Prumo

Ferramenta da Matizze para criar e manter aplicações React organizadas em camadas: telas com `index`, `model` e `view`, domínios com schema, repositório e queries, textos em dois idiomas e as regras que mantêm a arquitetura. O Prumo gera a estrutura e confere a arquitetura; **não traz frontend** (nenhum componente de interface, ícone, tema, CSS ou Storybook). A interface é do produto.

O plano está em [docs/plano.md](docs/plano.md).

## Situação

**Fase A do plano concluída (o extermínio).** O app de referência, o catálogo e o starter das fases anteriores saíram, e cada pacote perdeu o que era de interface: o `rules` cobra só a estrutura do projeto, o `testing` não tem Storybook nem navegador, e o `core` não depende de interface. A Fase B (os geradores simples, a partir de modelos que moram no `@matizze/prumo-cli`) está em andamento: a CLI tem `make:page`, `make:domain`, `make:component`, `check` e `doctor`, e o servidor MCP expõe as mesmas ferramentas. **Falta o `new`.** Nada foi publicado.

## Pacotes

| Pacote                                       | O que entrega                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`@matizze/prumo-core`](packages/core)       | Container de repositórios, query keys, tipo `Page`, utilitários de mock, i18n, erros, guarda de login e provedor de query |
| [`@matizze/prumo-rules`](packages/rules)     | Regras da arquitetura: plugin de ESLint (`page-structure`, `no-cross-page-import`) e a análise do `prumo check`           |
| [`@matizze/prumo-testing`](packages/testing) | Render com provedores, setup do DOM e teste de contrato de repositório, sem interface                                     |
| [`@matizze/prumo-cli`](packages/cli)         | O comando `prumo` (`make:page`, `make:domain`, `make:component`, `check` e `doctor`)                                      |
| [`@matizze/prumo-mcp`](packages/mcp)         | Servidor MCP com os comandos da CLI, para agentes                                                                         |

## Comandos do monorepo

```bash
pnpm install
pnpm verify            # typecheck, lint e testes dos pacotes
```

Requisitos: Node 24 e pnpm 10.
