# Roadmap

## O que o Prumo é

O Prumo é uma **ferramenta** para criar e manter aplicações React organizadas em camadas (telas → use cases → http e schemas): ele gera a estrutura (telas, use cases, schemas, textos em dois idiomas e testes) e confere a arquitetura a cada mudança. **Não traz frontend**: nenhum componente de interface, ícone, tema, CSS, Storybook, tela pronta ou catálogo de blocos. O critério para qualquer decisão é um só: se uma peça só faz sentido com uma interface específica, ela não é do Prumo.

## O que existe hoje

- **Comandos:** `new`, `make:schema`, `make:usecase`, `make:page`, `check`, `list` e `mcp`, um por camada, com opções e códigos de saída na [referência da CLI](reference/cli.md).
- **Use cases:** a ação com Request e Response em zod e um `execute`, de leitura ou de escrita (pelo verbo), sem API (`--local`) ou os cinco do CRUD de uma entidade (`--crud`). Veja [Use cases](guides/use-cases.md).
- **Telas a partir de um use case:** `make:page --usecase` gera a lista, o detalhe ou o formulário, inclusive em subpastas (`make:page auth.login`). Veja [Telas](guides/pages.md).
- **Mock no transporte:** com `VITE_DATA_SOURCE=mock` (o padrão e o dos testes), um `http` de mentira responde pelo endereço de cada use case; com `http`, o mesmo código fala com a API. Veja [Ligar uma API real](guides/real-api.md).
- **Regras de camada:** a tela não importa de `src/http`, o use case não importa de tela, de React nem do TanStack, e todo use case tem os tipos e o teste ao lado. O ESLint e o `prumo check` conferem. Veja [Arquitetura](concepts/architecture.md#as-regras).
- **Login:** o use case `auth.sign-in`, a tela `auth.login` e o `AuthGuard` do core. Veja [Login e sessão](guides/auth.md).
- **`prumo mcp`:** o servidor MCP do projeto, por stdio, com uma ferramenta por comando, para agentes de IA. Veja [Agentes de IA](guides/ai-agents.md#o-servidor-mcp).
- **Pacotes de apoio:** o [core](reference/core.md), as [regras](reference/rules.md) e o [testing](reference/testing.md), que o app gerado já traz.

## Próximos passos

Os que vêm primeiro, nesta ordem:

1. **A sessão no core e o `make:auth`.** A sessão de verdade (o token guardado, a renovação no 401, o logout limpando o cache e o token indo no `http`) passa a vir do `@matizze/prumo-core`, e o `make:auth` a liga ao app, aos use cases de entrar e sair e ao `AuthGuard`, como o Breeze do Laravel faz. Hoje a sessão é escrita pelo produto ([Login e sessão](guides/auth.md)).
2. **A tela de edição que carrega o registro.** `make:page livro-editar --usecase livros.update-livro --path /livros/:id/editar`: ler o `:id` da rota, carregar o registro com o `get-*` e enviar só o que mudou. Hoje o formulário de update não lê a rota, e o checkbox desmarcado envia `false`.
3. **Os rótulos do enum nas mensagens.** As opções de um campo `enum` mostram o valor (`lido`, `lendo`); passam a sair nos arquivos de mensagens, para traduzir.
4. **A lista a partir de um Response com campos soltos.** Hoje a lista exige `<entidade>[]` ou `Page`; passa a aceitar também um `z.array(z.object({ ... }))`.

Ideias mais longe, sem data e sem compromisso:

- `--from openapi.json` no `make:schema` e no `make:usecase`: os campos e as rotas saem da especificação da API. Só JSON; ler YAML pede uma dependência nova.
- `destroy <tipo> <nome>`: desfaz o que um `make:*` gerou.
- `make:locale <idioma>`: acrescenta um idioma com as mesmas chaves.
- `make:component` e `move:component`, se fizerem falta.
- No `http`: o erro 422 (validação) vira um erro com código, tratado como os demais erros do app, e o `UIError` carrega o corpo da resposta.
