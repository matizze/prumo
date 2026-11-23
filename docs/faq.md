# Perguntas frequentes e solução de problemas

## Perguntas frequentes

### O Prumo é um framework?

Não. Ele é uma ferramenta que **gera** a estrutura de um app React e **confere** a arquitetura. O app gerado é um projeto Vite comum, com bibliotecas conhecidas (React, TanStack Query, zod, i18next, wouter), e não depende do Prumo para rodar: o `@matizze/prumo-core` é uma biblioteca de infraestrutura que ele importa, e os outros quatro pacotes são dependências de desenvolvimento.

### Por que o Prumo não tem componentes de interface?

Porque a arquitetura que ele cobra vale para qualquer interface. Um app do Prumo pode usar o design system da empresa, o de um cliente ou nenhum, e trocar de um para outro sem mexer nos dados, nos textos e nos testes. Veja [Design system](guides/design-system.md).

### Posso usar com Next.js, Remix ou React Router?

Os geradores supõem um app Vite com o wouter como roteador e o alias `@/`. As regras de ESLint, o `prumo check` e o `@matizze/prumo-core` (menos o `AuthGuard`, que usa o wouter) não dependem disso. Veja [Projeto existente](guides/existing-project.md).

### Posso usar npm ou yarn?

O Prumo usa o pnpm: o `prumo new` roda `pnpm install`, os scripts do app chamam `pnpm`, e o `prumo doctor` avisa se o `packageManager` não é pnpm. Os pacotes em si são pacotes npm comuns e se instalam com qualquer gerenciador, mas o fluxo documentado e testado é com o pnpm.

### Por que Node 24?

O Node 24 é a versão mínima que o Prumo testa e o `prumo doctor` cobra. A CLI é escrita em TypeScript moderno e compilados para ES2023.

### Preciso usar os geradores?

Não. Os geradores economizam tempo e acertam os registros (rota, textos, índices), mas uma tela escrita à mão que segue a estrutura passa nas mesmas regras. O `prumo check` não sabe quem escreveu o arquivo.

### O Prumo funciona sem os dois idiomas?

O app gerado nasce com `pt-BR` e `en`, e o `prumo check` compara os dois. Um produto só em português pode manter o inglês como tradução mínima, ou remover o idioma e cobrar os textos pela API da análise com `locales: ['pt-BR']`. Veja [Textos e idiomas](guides/i18n.md).

### Onde fica o estado global da aplicação?

O Prumo não decide. Estado de tela fica no model; dado do servidor fica no cache do TanStack Query, por domínio. Se o produto precisar de um store global (sessão, preferências), ele escolhe a biblioteca e o lugar, normalmente um provedor em `src/providers/` (a sessão de login, por exemplo, fica em `src/providers/session/`: veja [Sessão e login](guides/auth.md)).

### Como atualizo o Prumo num app existente?

Atualize os pacotes com o pnpm (`pnpm up "@matizze/prumo-*" --latest`) e rode `pnpm exec prumo doctor`: ele confere se as versões instaladas estão na faixa que a CLI espera. As mudanças de cada versão estão no `CHANGELOG.md` de cada pacote. Os arquivos que o `prumo new` já gerou são do app e não mudam com a atualização.

## Solução de problemas

### `prumo make:domain` recusa o nome do domínio

```text
prumo make:domain: tirar o 's' de 'categories' daria 'categorie', que provavelmente não é o singular: informe a entidade com --entity (provavelmente --entity category).
```

O nome do domínio vai no plural, e a entidade sai dele tirando o `s`. Quando a regra erra, informe a entidade: `prumo make:domain categories --entity category`.

### Um componente recém-gerado com `--shared` aparece no `prumo check`

```text
src/components/shared/cartao.tsx  [shared-usage]  O módulo não é usado por nenhuma tela, ...
```

É esperado: o que está em `shared` precisa ser usado por duas telas ou mais, e o componente novo ainda não é usado. A violação some quando duas telas o importarem. Se só uma tela vai usá-lo, gere-o com `--page <tela>`.

### O `prumo check` acusa uma chave que falta num idioma

Acrescente a chave no JSON do idioma indicado, com a tradução. Se a chave não é mais usada, apague-a de todos os idiomas.

### O `pnpm lint` acusa `prumo/no-cross-page-import` num teste

A regra vale também para testes: um teste dentro de `src/pages/<tela>/` não importa outra tela. Testes que renderizam o app inteiro (navegação entre telas) ficam fora da pasta das telas, por exemplo em `src/app.test.tsx`.

### Os testes encontram os textos em inglês

O jsdom diz que o navegador está em `en-US`, e o i18n detecta o inglês. Fixe o idioma no `src/test/setup.ts`; veja [Testes](guides/test.md#o-idioma-dos-testes).

### O `prumo doctor` avisa que falta o `packageManager`

Fixe a versão do pnpm no `package.json` com `"packageManager": "pnpm@<versão>"` (a mensagem do `doctor` sugere a versão instalada). Apps criados pelo `prumo new` já vêm com o campo.

### O `prumo doctor` avisa que um pacote está fora da faixa

- **"está atrás da faixa"**: o pacote é mais antigo do que a CLI espera. Atualize-o.
- **"está à frente da faixa"**: a CLI é mais antiga que o pacote. Atualize o `@matizze/prumo-cli`.

### O `prumo doctor` avisa sobre o `.npmrc` e o GitHub Packages

Os pacotes do Prumo passaram por uma fase provisória no GitHub Packages. Hoje eles estão no npm público: a linha `@matizze:registry=https://npm.pkg.github.com` pode sair do `.npmrc`, e o token também.

### O `pnpm install` do `prumo new` falhou

O app fica criado na pasta. Corrija o que o pnpm disse (rede, versão do Node) e rode `pnpm install` dentro dela.

### O agente de IA não segue as regras do Prumo

Confira se o agente lê o `AGENTS.md` da raiz do projeto (o Claude Code lê o `CLAUDE.md`, que pode importá-lo). Veja [Agentes de IA](guides/ai-agents.md#o-agentsmd).

### Um gerador diz que não acha o `<Switch>`, o `factories` ou um índice

O gerador procura pontos de registro com uma forma conhecida, e recusa sem escrever nada quando não os acha. A lista está em [Anatomia do app gerado](concepts/generated-app.md#pontos-de-registro).
