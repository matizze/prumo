# Perguntas frequentes e solução de problemas

## Perguntas frequentes

### O Prumo é um framework?

Não. Ele é uma ferramenta que **gera** a estrutura de um app React e **confere** a arquitetura. O app gerado é um projeto Vite comum, com bibliotecas conhecidas (React, TanStack Query, zod, i18next, wouter), e não depende do Prumo para rodar: o `@matizze/prumo-core` é uma biblioteca de infraestrutura que ele importa, e os outros quatro pacotes são dependências de desenvolvimento.

### Por que o Prumo não tem componentes de interface?

Porque a arquitetura que ele cobra vale para qualquer interface. Um app do Prumo pode usar o design system da empresa, o de um cliente ou nenhum, e trocar de um para outro sem mexer nos dados, nos textos e nos testes. Veja [Design system](guides/design-system.md).

### Posso usar com Next.js, Remix ou React Router?

Os geradores supõem um app Vite com o wouter como roteador e o alias `@/`. As regras de ESLint, o `prumo check` e o `@matizze/prumo-core` (menos o `AuthGuard`, que usa o wouter) não dependem disso. Veja [Projeto existente](guides/existing-project.md).

### Posso usar npm ou yarn?

O Prumo usa o pnpm: o `prumo new` roda `pnpm install`, os scripts do app chamam `pnpm` e o `package.json` fixa o pnpm em `packageManager`. Os pacotes em si são pacotes npm comuns e se instalam com qualquer gerenciador, mas o fluxo documentado e testado é com o pnpm.

### Por que Node 24?

O Node 24 é a versão mínima que o Prumo testa: a CLI publicada roda JavaScript compilado (`dist/`) e usa recursos do Node moderno; no monorepo do Prumo ela roda o TypeScript direto.

### Preciso usar os geradores?

Não. Os geradores economizam tempo e acertam os registros (rota, textos, índices), mas uma tela escrita à mão que segue a estrutura passa nas mesmas regras. O `prumo check` não sabe quem escreveu o arquivo.

### O Prumo funciona sem os dois idiomas?

O app gerado nasce com `pt-BR` e `en`, e o `prumo check` compara os dois. Um produto só em português pode manter o inglês como tradução mínima, ou remover o idioma e cobrar os textos pela API da análise com `locales: ['pt-BR']`. Veja [Textos e idiomas](guides/i18n.md).

### Onde fica o estado global da aplicação?

O Prumo não decide. Estado de tela fica no model; dado do servidor fica no cache do TanStack Query, por domínio. Se o produto precisar de um store global (sessão, preferências), ele escolhe a biblioteca e o lugar, normalmente um provedor em `src/providers/` (a sessão de login, por exemplo, fica em `src/providers/session/`: veja [Sessão e login](guides/auth.md)).

### Como atualizo o Prumo num app existente?

Atualize os pacotes com o pnpm (`pnpm up "@matizze/prumo-*" --latest`) e rode `pnpm verify`. As mudanças de cada versão estão no `CHANGELOG.md` de cada pacote. Os arquivos que o `prumo new` já gerou são do app e não mudam com a atualização.

### Cadê o `make:domain`, o `make:component`, o `doctor` e o MCP?

Saíram na v1 (`@matizze/prumo-cli` 0.7.0):

- `make:domain` virou três comandos, um por camada: `make:schema`, `make:repository` e `make:query`.
- `--domain` do `make:page` virou `--query`.
- A fonte de dados `memory` virou `mock`.
- `make:component` e `move:component` saíram sem substituto: os componentes de interface vêm do design system do produto, e os do produto se criam à mão (veja [Telas](guides/pages.md#componentes)).
- `doctor` saiu sem substituto.
- O servidor MCP voltou como um comando da própria cli, o [`prumo mcp`](reference/cli.md#prumo-mcp), com uma ferramenta por comando (veja [Agentes de IA](guides/ai-agents.md#o-servidor-mcp)). O pacote `@matizze/prumo-mcp` não volta: use `prumo mcp`, a partir do `@matizze/prumo-cli` 0.8.0.

## Solução de problemas

### `prumo make:schema` recusa o nome do domínio

```text
prumo: tirar o 's' de 'categories' daria 'categorie', que provavelmente não é o singular: informe a entidade com --entity (provavelmente --entity category).
```

O nome do domínio vai no plural, e a entidade sai dele tirando o `s`. Quando a regra erra, informe a entidade: `prumo make:schema categories --entity category`. Use o mesmo `--entity` no `make:repository` e no `make:query`.

### O `make:repository` ou o `make:query` diz que falta uma camada

```text
prumo: falta o schema clientes (src/schemas/entities/cliente.ts); rode prumo make:schema clientes.
```

Cada camada usa a de baixo, e o comando recusa sem criar nada quando ela não existe. Rode, em ordem, `make:schema`, `make:repository` e `make:query`. Se o schema foi gerado com `--entity`, a mensagem lembra de repetir a opção.

### O `make:repository` não reconhece um campo do schema

O comando lê os campos do schema com os tipos do `--fields` (`string`, `number`, `int`, `boolean`, `date`, `datetime` e `enum`). Um campo como `z.string().min(3)` é erro de uso, com a linha. Deixe o campo no tipo simples, gere o repositório e acrescente a validação depois. Veja [O leitor de campos](guides/domains.md#o-leitor-de-campos).

### Um componente em `shared` aparece no `prumo check`

```text
src/components/shared/cartao.tsx  [shared-usage]  O módulo não é usado por nenhuma tela, ...
```

É esperado: o que está em `shared` precisa ser usado por duas telas ou mais. A violação some quando duas telas o importarem. Se só uma tela o usa, mova-o para `src/pages/<tela>/components/`.

### O `prumo check` acusa uma chave que falta num idioma

Acrescente a chave no JSON do idioma indicado, com a tradução. Se a chave não é mais usada, apague-a de todos os idiomas.

### O `pnpm lint` acusa `prumo/no-cross-page-import` num teste

A regra vale também para testes: um teste dentro de `src/pages/<tela>/` não importa outra tela. Testes que renderizam o app inteiro (navegação entre telas) ficam fora da pasta das telas, por exemplo em `src/app.test.tsx`.

### Os testes encontram os textos em inglês

O jsdom diz que o navegador está em `en-US`, e o i18n detecta o inglês. Fixe o idioma no `src/test/setup.ts`; veja [Testes](guides/test.md#o-idioma-dos-testes).

### O `pnpm install` do `prumo new` falhou

O app fica criado na pasta. Corrija o que o pnpm disse (rede, versão do Node) e rode `pnpm install` dentro dela.

### O agente de IA não segue as regras do Prumo

Confira se o agente lê o `AGENTS.md` da raiz do projeto (o Claude Code lê o `CLAUDE.md`, que pode importá-lo) e se ele usa as ferramentas do servidor `prumo` (no Claude Code, o `/mcp` mostra se está conectado). Veja [Agentes de IA](guides/ai-agents.md#o-agentsmd).

### Um gerador diz que não acha o `<Switch>`, o `factories` ou um índice

O gerador procura pontos de registro com uma forma conhecida, e recusa sem escrever nada quando não os acha. A lista está em [Anatomia do app gerado](concepts/generated-app.md#pontos-de-registro).
