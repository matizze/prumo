# Documentação do Prumo

O Prumo é uma ferramenta para criar e manter aplicações React organizadas em camadas. Esta pasta reúne tudo o que é preciso para usá-lo, do primeiro app até a referência de cada função.

A documentação segue quatro tipos de texto, cada um para um momento:

| Se você quer...                                  | Leia                         |
| ------------------------------------------------ | ---------------------------- |
| Começar do zero, seguindo um caminho guiado      | [Tutorial](#tutorial)        |
| Entender como as peças se encaixam e por quê     | [Conceitos](#conceitos)      |
| Resolver uma tarefa específica no seu app        | [Guias](#guias)              |
| Consultar uma opção, uma função ou um tipo       | [Referência](#referência)    |

## Tutorial

- [Primeiros passos](getting-started.md): cria um app, gera o schema, os use cases, uma tela que lista e um formulário, muda os textos, roda os testes e a verificação. Leva cerca de 20 minutos.

## Conceitos

- [Arquitetura](concepts/architecture.md): as camadas (telas → use cases → http e schemas), as regras que o Prumo cobra e o motivo de cada uma.
- [Anatomia do app gerado](concepts/generated-app.md): arquivo por arquivo, o que o `prumo new` cria e quais pontos os comandos usam.

## Guias

| Guia                                                     | Para                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Telas](guides/pages.md)                                  | Criar telas (em subpastas e a partir de um use case: lista, detalhe e formulário), separar model e view, componentes do produto, rotas com parâmetro, navegação e rotas protegidas |
| [Use cases](guides/use-cases.md)                         | Criar um use case (`make:usecase`, com `--crud` e `--local`) e o schema da entidade (`make:schema`), os campos, mudar a forma do dado, filtros, regras de negócio e operações entre domínios |
| [Ligar uma API real](guides/real-api.md)                  | Ligar os use cases à API, escolher a fonte de dados por ambiente e rodar o contrato contra uma API de teste |
| [Migrar para use cases](guides/migrate-to-use-cases.md) | Trocar o repository e as queries de um app (cli até a 0.9) por use cases: o que muda, passo a passo, com antes e depois |
| [Login e sessão](guides/auth.md)                          | O login gerado (`auth.sign-in` e `auth.login`), o `AuthGuard` com origem e, até a sessão chegar ao core, um jeito de escrevê-la |
| [Textos e idiomas](guides/i18n.md)            | Textos por tela, ICU (plural, select), formatação de números e datas, trocar e criar idiomas |
| [Erros e notificações](guides/errors-and-notifications.md)    | Erros com código, tradução do erro, notificação global e o `meta` das queries             |
| [Testes](guides/test.md)                                | Testar telas, hooks de query e mutation, provedores do app (a sessão) e use cases |
| [Design system](guides/design-system.md)                  | Ligar a interface do produto: a pasta `ui`, a casca do layout e as notificações           |
| [Agentes de IA](guides/ai-agents.md)                  | Usar o `AGENTS.md` e o servidor MCP (`prumo mcp`) com agentes de IA |
| [Projeto existente](guides/existing-project.md)          | Adotar as regras e os geradores num app React que já existe                               |

## Referência

| Referência                               | Conteúdo                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| [CLI](reference/cli.md)                 | Os comandos `new`, `make:schema`, `make:usecase`, `make:page`, `check`, `list` e `mcp`, com opções, a ajuda e os códigos de saída |
| [core](reference/core.md)               | `@matizze/prumo-core`: http, use cases, query, i18n, erros, dados, mock e auth       |
| [rules](reference/rules.md)             | `@matizze/prumo-rules`: as regras de ESLint e a análise do `prumo check`          |
| [testing](reference/testing.md)         | `@matizze/prumo-testing`: render com provedores, DOM e teste de contrato          |

## Mais

- [Perguntas frequentes e solução de problemas](faq.md)
- [Como o Prumo funciona por dentro](contributing/internals.md), para quem mantém os pacotes
- [Como contribuir](../CONTRIBUTING.md)
- [Roadmap](roadmap.md): o que o Prumo é e o que vem depois
