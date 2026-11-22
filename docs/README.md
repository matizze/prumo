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

- [Primeiros passos](getting-started.md): cria um app, gera um domínio, uma tela e um componente, roda os testes e a verificação. Leva cerca de 15 minutos.

## Conceitos

- [Arquitetura](concepts/architecture.md): as camadas, as regras que o Prumo cobra e o motivo de cada uma.
- [Anatomia do app gerado](concepts/generated-app.md): arquivo por arquivo, o que o `prumo new` cria e quais pontos os geradores usam.

## Guias

| Guia                                                     | Para                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Telas](guides/pages.md)                                  | Criar telas, separar model e view, rotas com parâmetro, navegação e rotas protegidas      |
| [Domínios de dados](guides/domains.md)                   | Criar um domínio, mudar o schema, as fixtures e o contrato, usar queries e mutations      |
| [Ligar uma API real](guides/real-api.md)                  | Escrever o repositório HTTP, escolher a fonte de dados por ambiente e validar o contrato   |
| [Textos e idiomas](guides/i18n.md)            | Textos por tela, ICU (plural, select), formatação de números e datas, trocar e criar idiomas |
| [Erros e notificações](guides/errors-and-notifications.md)    | Erros com código, tradução do erro, notificação global e o `meta` das queries             |
| [Testes](guides/test.md)                                | Testar telas, estados de carregamento e erro, navegação e repositórios                    |
| [Design system](guides/design-system.md)                  | Ligar a interface do produto: a pasta `ui`, a casca do layout e as notificações           |
| [Agentes de IA](guides/ai-agents.md)                  | Usar o servidor MCP e o `AGENTS.md` com o Claude Code ou outro cliente MCP                |
| [Projeto existente](guides/existing-project.md)          | Adotar as regras e os geradores num app React que já existe                               |

## Referência

| Referência                               | Conteúdo                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| [CLI](reference/cli.md)                 | Os seis comandos do `prumo`, opções, arquivos criados, saídas e códigos de saída  |
| [core](reference/core.md)               | `@matizze/prumo-core`: repositórios, query, i18n, erros, dados, mock e auth       |
| [rules](reference/rules.md)             | `@matizze/prumo-rules`: as regras de ESLint e a análise do `prumo check`          |
| [testing](reference/testing.md)         | `@matizze/prumo-testing`: render com provedores, DOM e teste de contrato          |
| [MCP](reference/mcp.md)                 | `@matizze/prumo-mcp`: o servidor, as ferramentas e os limites de segurança        |

## Mais

- [Perguntas frequentes e solução de problemas](faq.md)
- [Como o Prumo funciona por dentro](contributing/internals.md), para quem mantém os pacotes
- [Como contribuir](../CONTRIBUTING.md)
- [Plano e decisões do projeto](plan.md)
