# @matizze/prumo-core

## 0.4.0

### Minor Changes

- 61b3901: Sai o subcaminho `@matizze/prumo-core/repositories` (`createRepositoryContainer`, `createRepositoryContext`, os tipos `RepositoryOptions`, `RepositoryFactories`, `RepositoryContainerOf` e `RepositoryProviderProps`). O `resolveDataSource` e o contexto dos use cases ficam em `@matizze/prumo-core/use-cases`. Para migrar, veja o guia [Migrar para use cases](https://docs.prumo.matizze.com.br/guides/migrate-to-use-cases).
- 6411393: Use cases no lugar do repository. Entram `@matizze/prumo-core/http` (`createHttp`, com o `query` que vira query string, `HttpError` com o `body` da resposta de erro e os tipos, e `createMockHttp`, um `http` de mentira que responde por rotas como `'GET /livros/:id'`, sem rede e sem dependência, com os `params` tipados pela chave da rota e o `MissingMockRouteError` para a rota sem mock), `@matizze/prumo-core/use-cases` (`IUseCase`, `UseCaseInput`, `UseCaseOutput`, `createUseCasesContext` e `resolveDataSource`) e `createMockCollection` em `@matizze/prumo-core/mock`, a coleção em memória que os mocks de um CRUD dividem. O módulo `repositories` sai (veja o changeset `remove-repositories-core`).

## 0.3.0

### Minor Changes

- 1c5a2bb: Licença MIT, metadados do pacote (palavras-chave, página, relato de problemas, autor e Node 24 ou mais novo) e o README com os links do site da documentação. Quebra de compatibilidade: o ponto de entrada `.` do `exports`, que só exportava o nome do pacote (`PACKAGE_NAME`), saiu. Quem importava a raiz passa a importar pelos subcaminhos.

## 0.2.1

### Patch Changes

- d60b9c3: Os exemplos do README usam a fonte de dados `mock` (antes `memory`).

## 0.2.0

### Minor Changes

- cd4518e: Correções e novidades do core, vindas de um app real:
  
  - `format.date('AAAA-MM-DD')` mostra o dia escrito: texto só com a data passa a ser lido como data local, e não como meia-noite em UTC (que virava o dia anterior no Brasil). ISO com hora, `Date` e número seguem como antes.
  - `AuthGuard` ganha a opção `keepOrigin`, que leva a rota pedida (caminho e query) ao login em `?next=`. Novos `useAuthOrigin`, `safeRedirectPath`, `buildLoginRedirect` e `readOrigin` (em `@matizze/prumo-core/auth`) deixam o login voltar para ela, aceitando só caminho relativo do próprio app (sem redirecionamento aberto). Sem `keepOrigin`, nada muda.
  - `UIError` aceita `params` opcionais (valores do texto ICU), e o `getErrorMessage` os passa ao `t`, aceita um código solto (`getErrorMessage('LOAN_LIMIT', { limite: 3 })`) e um segundo argumento com valores. Quem usa `new UIError(code, message)` não muda.
  - Novo subcaminho `@matizze/prumo-core/date` com `addDays`, `daysBetween` e `parseLocalDate`, para regras de negócio. O `@matizze/prumo-core/mock` continua exportando `addDays`.

### Patch Changes

- 0eb8d2b: O README de cada pacote, que é a página dele no npm, foi reescrito: instalação, uso essencial e links para a documentação completa do Prumo (tutorial, guias e referência). A descrição do `@matizze/prumo-cli` no npm passa a citar todos os comandos.

## 0.1.4

### Patch Changes

- O README publicado no npm deixa de dizer que o pacote não foi publicado e ganha a seção Instalação.

## 0.1.3

### Patch Changes

- 3e763de: Publicado no npm público (`registry.npmjs.org`, acesso público), sem token para instalar.

## 0.1.2

### Patch Changes

- c422a51: Pronto para publicar no GitHub Packages: sem `"private": true` e com `repository` apontando para o repositório.
- e19be78: O `@matizze/prumo-core` foi conferido e não depende de interface: nenhum componente visual, CSS nem ícone, e o `AuthGuard` e o `QueryProvider` só repassam os `children` (e o `fallback` que o produto passa). Só os comentários e a documentação deixaram de citar biblioteca de notificação e Storybook; o código não muda.

## 0.1.1

### Patch Changes

- 7a58c82: O pacote passa a sair com `dist/` (`.js` e `.d.ts`), compilado com o `tsc`, pronto para a publicação: o `pnpm pack` troca o `exports` para o `dist/`, e o tarball não leva código-fonte nem testes. No workspace nada muda.

## 0.1.0

### Minor Changes

- 00d3514: Novo módulo `@matizze/prumo-core/auth` com o `AuthGuard`, a guarda de rota do login. O produto passa o estado da sessão (`isAuthenticated` e `isLoading`), e o componente só mostra o conteúdo com a sessão aberta; sem sessão, troca a entrada do histórico por `redirectTo` (padrão `/login`). Enquanto a sessão carrega, mostra o `fallback` (padrão: nada), porque o core não importa componente de UI. O `react` e o `wouter` entram como `peerDependencies`.
- f5074ef: Novo módulo `@matizze/prumo-core/data` com o `pageSchema` e os tipos `Page`, `PageQuery`, `Sort`, `SortDirection` e `DateRange`, o formato comum das listagens paginadas. O `zod` entra como peer dependency, porque o `pageSchema` recebe o schema do item do seu produto.
- d9aad4d: O módulo `@matizze/prumo-core/errors` ganha `createErrorMessage(i18n, options?)`, que cria o `getErrorMessage(error)` do produto a partir de uma instância i18next. Um `UIError` cujo código tem tradução (`errors.<CODE>`) vira o texto no idioma ativo; código sem tradução e qualquer outro erro (bug, rede, falha do storage) viram o texto genérico, para não vazar mensagem técnica. As opções `prefix` (padrão `errors.`) e `fallbackKey` (padrão `errors.generic`) ajustam as chaves ao produto. O `i18next` já é `peerDependency` do pacote e entra aqui só como tipo.
- 3a90e0c: Novo módulo `@matizze/prumo-core/i18n` com `defineI18n(config)`, a fábrica que liga o i18n a um produto. O produto passa as mensagens (`messages`, em que o idioma padrão é a fonte dos tipos das chaves), o `defaultLocale`, a `storageKey` (padrão `locale`), os `rtlLocales`, a `defaultCurrency` (padrão `BRL`) e os nomes dos `languages`, e recebe a instância (`i18n`), `createI18n`, `I18nProvider`, `useTranslations`, `getTranslations`, `useLocale`, `getLocale`, `useChangeLocale`, `useFormat`, `getFormat`, `useFieldError`, `routing`, `isLocale`, `isRtl`, `resolveLocale`, `languages`, `getLanguage` e `LOCALE_STORAGE_KEY`, todos tipados pelas mensagens do produto, por inferência e sem aumento de módulo: chave ou namespace inexistente não compila. O módulo também exporta `createFormat` (com a moeda padrão como opção), `resolveLocale(code, supported)` e os tipos `MessageKeyOf`, `NamespaceOf`, `TranslatorOf`, `TranslationValues`, `Format`, `LanguageOf` e `MessageTree`. O `i18next`, o `react-i18next`, o `i18next-icu` e o `i18next-browser-languagedetector` entram como `peerDependencies`.
- cbd792e: Novo módulo `@matizze/prumo-core/mock` com os utilitários dos repositórios mock: `wait` (latência simulada), `normalize` e `matchesSearch` (busca sem acento), `sortBy`, `paginate`, `sum` e `addDays`. O `sortBy` compara texto em `pt-BR` por padrão e aceita outro idioma pela opção `locale`.
- f24d5ac: O módulo `@matizze/prumo-core/query` ganha o cliente e o provedor do React Query, junto com o `createQueryKeys`. `createQueryClient({ notify, getErrorMessage, defaultOptions? })` devolve um `QueryClient` com os padrões do Prumo (`staleTime` de 30 s, `gcTime` de 5 min, `retry` 1 e sem refetch ao voltar o foco; `defaultOptions` sobrescreve) e a notificação global de erro: avisa a falha de refetch em segundo plano (quando há dados em cache) e o erro de qualquer mutation, pelo `notify` que o produto injeta (o core não conhece o toaster), com o texto de `getErrorMessage`. `meta: { silent: true }` desliga o aviso e `meta: { errorMessage }` troca o texto. O módulo também aumenta o tipo do `meta` do TanStack (`Register`), então `meta: { silencioso: true }` não compila, e exporta `ErrorMeta` e `QueryProvider({ children, createClient })`, que cria um client por montagem. O `@tanstack/react-query` entra como `peerDependency`, e o subcaminho passa a carregá-lo, inclusive para quem só usa o `createQueryKeys`.
- 4608df5: Novo módulo `@matizze/prumo-core/query` com o `createQueryKeys`, a fábrica das query keys de um domínio. `createQueryKeys('catalog', { lists: ['list'], detail: (id: string) => ['detail', id] as const })` devolve um objeto com `all` (o prefixo `['catalog']`) e uma entrada por definição, já com o domínio na frente de cada tupla e com os tipos literais preservados. Tuplas fixas não precisam de `as const`; as de funções precisam.
- 8a2241f: Novo módulo `@matizze/prumo-core/repositories` com o container e o provedor de repositórios. `createRepositoryContainer(factories, options)` chama cada fábrica de domínio com as mesmas opções (`RepositoryOptions<S>`, com `dataSource` e `latencyMs`) e devolve o container tipado pelo mapa de fábricas (`RepositoryContainerOf<F>`). `resolveDataSource(value, sources, fallback, name?)` lê a fonte de dados de uma configuração, usa o `fallback` quando o valor é vazio e falha na inicialização, em vez de cair em silêncio em outra fonte, quando o valor é inválido. `createRepositoryContext<C>(createDefault?)` devolve o `RepositoryProvider` e o `useRepositories` já tipados com o container do produto: o provedor aceita um `value` injetado (testes e Storybook) ou cria o padrão uma única vez por montagem.
- 2af6f06: Novo módulo `@matizze/prumo-core/errors` com o `UIError`, o erro com código estável que os repositórios lançam e que a interface traduz pela chave `errors.<CODE>`.

### Patch Changes

- be0fd64: `createErrorMessage` confere na criação que a chave de reserva (`errors.generic`, por padrão) existe nas mensagens da instância i18next e lança um `Error` claro se não existir, em vez de a tela mostrar a própria chave; a instância precisa estar inicializada, como a do `defineI18n`. O `ErrorMeta`, de `@matizze/prumo-core/query`, passa a ser uma `interface`, e o produto pode acrescentar campos ao `meta` por declaration merging (o README do core mostra como), sem perder a tipagem do meta registrada no TanStack.
