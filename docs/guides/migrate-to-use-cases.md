# Migrar para use cases

Até a cli 0.9 e o core 0.3, o app buscava dado por um **repositório** (`src/repositories/<domínio>/`) e por **queries** (`src/queries/<domínio>.ts`). Da cli 0.10 e do core, rules e testing 0.4 em diante, o **use case** é o único caminho: uma ação com nome de verbo (`listClientes`, `signIn`), com um Request, um Response e um `execute`. Este guia mostra o que trocar e por quê. Os apps nas versões anteriores continuam funcionando como estão: como os pacotes estão em 0.x, o `^0.3.0` do `package.json` não sobe sozinho para a 0.4.0. A migração é uma escolha sua, e não precisa ser de uma vez só: faça um domínio por vez, com os pacotes novos já instalados.

## O que sai e o que entra

| Antes                                                          | Depois                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `prumo make:repository <domínio>`                              | `prumo make:usecase <domínio> --crud` (ou um `make:usecase <domínio>.<ação>` por ação) |
| `prumo make:query <domínio>`                                   | nada: a tela usa o use case com `useQuery` e `useMutation`              |
| `prumo make:page <tela> --query <domínio>`                     | `prumo make:page <tela> --usecase <domínio>.<ação>`                     |
| `src/repositories/<domínio>/` (contrato, mock, fixtures, fábrica) | `src/use-cases/<domínio>/` (`types/`, `services/` e `mocks/`) |
| `src/repositories/index.ts` (o container) e `RepositoryProvider` | `src/use-cases/index.ts` (o registro) e `UseCasesProvider`           |
| `src/queries/<domínio>.ts` (chaves e hooks)                    | a chave `<ação>Key` de `types/<ação>.ts` e o `useQuery` no model da tela |
| `useRepositories()`                                            | `useUseCases()`                                                         |
| `@matizze/prumo-core/repositories`                             | `@matizze/prumo-core/use-cases` e `@matizze/prumo-core/http`            |
| fontes `mock`, `http` e `storage` por repositório              | `VITE_DATA_SOURCE=mock` ou `http` para o app inteiro; `--local` para dados no navegador |
| teste de contrato com `repo`                                   | teste do use case com `subject`                                         |

Por quê: a tela deixa de conhecer o formato de dado de um repositório com cinco métodos fixos e passa a chamar a ação que o produto faz; o mock sai da classe e vai para o transporte (um `http` de mentira), então o código que roda no desenvolvimento e nos testes é o mesmo da produção; e as camadas ficam cobradas por regra (a tela não importa de `src/http`, o use case não importa de React nem de TanStack).

## Passo a passo

**1. Atualize os pacotes** do Prumo para as novas versões (`pnpm up "@matizze/prumo-*" --latest`: `@matizze/prumo-cli` 0.10, e `-core`, `-rules` e `-testing` 0.4) e rode `pnpm install`. Um app criado antes dos use cases não tem `src/http/api.ts`, `src/http/errors.ts`, `src/use-cases/` nem `src/providers/use-cases/`: o mais curto é criar um app de referência (`pnpm dlx @matizze/prumo-cli new referencia --no-install`) e copiar esses arquivos, além do `src/test/render.tsx` e do `src/providers/app.tsx` dele.

**2. Gere os use cases de cada domínio.** O schema continua o mesmo. Para um domínio com CRUD:

```bash
pnpm exec prumo make:usecase clientes --crud
```

Isso cria `listClientes`, `getCliente`, `createCliente`, `updateCliente` e `removeCliente`, cada um com tipos, classe, mock e teste, cada um na sua pasta (`types/`, `services/`, `mocks/`). Os endereços REST (`GET /clientes`, `PATCH /clientes/:id`, ...) ficam no `ENDPOINT` de cada `types/<ação>.ts`: se a sua API usa outros, edite ali. Para o que não é CRUD (um `listByCity`), use `make:usecase clientes.list-by-city`. Passe os dados de exemplo do seu `fixtures.ts` para o `mocks/collection.ts`.

**3. Troque a fonte http.** O `repository.http.ts` fazia `fetch` por conta própria. No use case, o `execute` já chama o `http` (`createHttp`, em `src/http/api.ts`) e valida a resposta com o Response. Leve para o `ENDPOINT` e para o `execute` o que você tinha ajustado no repositório (outro caminho, outro formato de lista); a tradução do erro (um 403 em `UIError`) vai para o `toUIError` do `src/http/errors.ts`.

**4. Troque o model das telas.** Antes, a tela pegava um hook de `src/queries`; agora, pega o use case do registro:

```ts
// antes
import { useClientesList, useCreateCliente } from '@/queries/clientes'

const list = useClientesList({ search })
const create = useCreateCliente()
```

```ts
// depois
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUseCases } from '@/providers/use-cases'
import type { CreateClienteRequest } from '@/use-cases/clientes/types/create-cliente'
import { listClientesKey } from '@/use-cases/clientes/types/list-clientes'

const { listClientes, createCliente } = useUseCases()
const queryClient = useQueryClient()
const input = { search }

const list = useQuery({ queryKey: listClientesKey(input), queryFn: () => listClientes.execute(input) })
const create = useMutation({
  mutationFn: (input: CreateClienteRequest) => createCliente.execute(input),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
})
```

A escrita invalida o prefixo do domínio (`['clientes']`), que é também o prefixo que o `listClientesKey` usa; as mutations geradas faziam o mesmo com `clienteKeys.all`. Telas novas saem prontas de `make:page <tela> --usecase <domínio>.<ação>` (lista, detalhe ou formulário).

**5. Troque os testes.** `renderWithProviders` não recebe mais repositórios, e o parâmetro de tipo dos use cases vem primeiro:

```tsx
// antes
renderWithProviders(<ClientesPage />, { repositories: { clientes } })

// depois
renderWithProviders(<ClientesPage />, {
  useCases: { listClientes: { execute: async () => ({ items: [], total: 0 }) } },
})
```

```ts
// antes: createRenderWithProviders<RepositoryContainer, TestProviderProps, UseCases>(binding)
// depois:
createRenderWithProviders<UseCases, TestProviderProps>(binding)
```

O `createUseCases` do `binding` passa a ser obrigatório quando o `UseCases` é declarado. O `createTestRepositories` saiu (use o `createTestUseCases`), e, no `defineContractSuite`, o `repo` saiu: use o `subject`.

**6. Ajuste o ambiente.** O `VITE_DATA_SOURCE` agora aceita só `mock` (o padrão) e `http`; qualquer outro valor, como o `storage` dos repositórios, lança `Invalid VITE_DATA_SOURCE "storage". Expected one of: mock, http.`. Para guardar dados no navegador, crie o use case com `--local`.

**7. Apague o que sobrou.** Tire `src/repositories/`, `src/queries/` e `src/providers/repository/`, o `RepositoryProvider` do `src/providers/app.tsx` e do `src/test/render.tsx`, e as linhas de repositórios e queries dos índices. Rode `pnpm verify`: o `tsc` aponta o que ainda importa o que saiu, e o `prumo check` e o ESLint conferem as camadas novas.

## As regras novas

- **`prumo/no-http-in-page`** (ESLint): um arquivo de `src/pages` não importa de `src/http`. Quem fala com a API é o use case.
- **`prumo/use-case-imports`** (ESLint): um arquivo de `src/use-cases` não importa de `src/pages`, de `react` nem de `@tanstack/*`. O `useQuery` e o `useMutation` ficam no model da tela.
- **`use-case-files`** (`prumo check`): todo `services/<ação>.usecase.ts` tem o `types/<ação>.ts` na pasta irmã e o `.usecase.test.ts` ao lado.

O plugin recomendado (`prumo.configs.recommended`) já liga as duas regras de ESLint. Detalhes em [Referência do rules](../reference/rules.md).

## Do layout da 0.10 para o do pratigo

A cli 0.10 gerava os arquivos de cada ação lado a lado (`<ação>.types.ts`, `<ação>.usecase.ts`, `<ação>.mock.ts`), com `Input` e `Output` e um `try/catch` em cada `execute`. A cli 0.11 gera o layout do pratigo e tira o `try/catch`. O app da 0.10 continua funcionando como está, mas o `prumo check` da 0.11 espera o `types/<ação>.ts` na pasta irmã de `services/`, então **um domínio no layout antigo é acusado** até ser movido. Para mover um domínio:

| Na 0.10                                  | Agora                                         |
| ---------------------------------------- | --------------------------------------------- |
| `<ação>.types.ts`                        | `types/<ação>.ts`                             |
| `<ação>.usecase.ts`                      | `services/<ação>.usecase.ts`                  |
| `<ação>.usecase.test.ts`                 | `services/<ação>.usecase.test.ts`             |
| `<ação>.mock.ts`                         | `mocks/<ação>.ts`                             |
| `collection.mock.ts` (no `--crud`)       | `mocks/collection.ts`                         |
| `SignInInput` e `SignInOutput`           | `SignInRequest` e `SignInResponse`            |

1. Mova os arquivos e acerte os imports relativos (`../types/<ação>`, `../mocks/<ação>`, `./services/<ação>.usecase` no `index.ts` do domínio).
2. Troque os nomes `<Ação>Input` e `<Ação>Output` por `<Ação>Request` e `<Ação>Response` nos tipos, nos use cases, nos testes e nos models das telas.
3. Crie o `src/http/errors.ts` (copie o de um app novo, com o `errors.test.ts`), envolva o `createHttp` do `src/http/api.ts` e o `createMockHttp` do `src/use-cases/index.ts` com o `withErrors`, e acrescente aos dois `errors.json` os textos de `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` e `REQUEST_FAILED`.
4. Tire o `try/catch` dos `execute` e os códigos por use case (`SIGN_IN_FAILED`, `LIVRO_NOT_FOUND`) dos `errors.json`, a menos que o seu domínio use um deles de propósito (um `UIError` lançado por uma regra). Nos testes do `--crud`, o id que não existe agora é um `HttpError` 404 (`rejects.toMatchObject({ status: 404 })`) no lugar de `UIError` `<ENTIDADE>_NOT_FOUND`.

Rode `pnpm verify`. Um domínio novo, gerado pela 0.11, já nasce assim.

## O `prumo list` e o MCP

O `prumo list` (e o `--json`) não traz mais `repositories` nem `queries`: ficam `schemas`, `useCases`, `pages` e `languages`, e cada tela mostra o `useCase` que o model chama. O servidor MCP perde as ferramentas `make_repository` e `make_query`; use `make_usecase` (com `crud`) e `make_page` (com `usecase`).

## Para saber mais

- [Use cases](use-cases.md): o guia do dia a dia, com `--crud`, `--local` e as regras de negócio.
- [Arquitetura](../concepts/architecture.md#use-cases): as camadas e o porquê.
- [Por que use case e não repository?](../faq.md#por-que-use-case-e-não-repository)
