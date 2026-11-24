# Roadmap

## O que o Prumo é

O Prumo é uma **ferramenta** para criar e manter aplicações React organizadas em camadas: ele gera a estrutura (telas, domínios de dados, textos em dois idiomas e testes) e confere a arquitetura a cada mudança. **Não traz frontend**: nenhum componente de interface, ícone, tema, CSS, Storybook, tela pronta ou catálogo de blocos. O critério para qualquer decisão é um só: se uma peça só faz sentido com uma interface específica, ela não é do Prumo.

## O que existe hoje

- **Comandos:** `new`, `make:schema`, `make:repository`, `make:query`, `make:page`, `check` e `list`, um por camada, com opções e códigos de saída na [referência da CLI](reference/cli.md).
- **Fontes de dados:** `mock` (a padrão e a dos testes), `storage` (o mock gravando no `localStorage`) e `http` (`fetch` numa API), todas com o mesmo contrato e o mesmo teste de contrato. Veja [Domínios de dados](guides/domains.md) e [Ligar uma API real](guides/real-api.md).
- **`prumo mcp`:** o servidor MCP do projeto, por stdio, com uma ferramenta por comando, para agentes de IA. Veja [Agentes de IA](guides/ai-agents.md#o-servidor-mcp).
- **Pacotes de apoio:** o [core](reference/core.md), as [regras](reference/rules.md) e o [testing](reference/testing.md), que o app gerado já traz.

## Próximos passos

Ideias, sem data e sem compromisso:

- `--from openapi.json` no `make:schema` e no `make:repository --data-source http`: os campos e as rotas saem da especificação da API. Só JSON; ler YAML pede uma dependência nova.
- `make:domain`: atalho para schema, repositório e query de uma vez.
- `destroy <tipo> <nome>`: desfaz o que um `make:*` gerou.
- `doctor`: confere Node, pnpm e as versões dos pacotes do Prumo.
- `make:locale <idioma>`: acrescenta um idioma com as mesmas chaves.
- No `make:page`: tela de formulário, com as mutations do `make:query`.
- `make:component` e `move:component`, se fizerem falta.
- Na fonte `http`: o erro 422 (validação) vira um erro com código, tratado como os demais erros do app.
