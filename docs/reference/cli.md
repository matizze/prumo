# Referência da CLI

O comando `prumo`, do pacote [`@matizze/prumo-cli`](https://www.npmjs.com/package/@matizze/prumo-cli).

> **Os comandos estão sendo reescritos.** A CLI foi refeita com o commander, e os comandos voltam um a um nas próximas versões. Por enquanto ela tem o `new`, o `make:schema`, o `make:repository`, o `check`, a ajuda, a versão e os códigos de saída descritos aqui.

```text
prumo [opções] [comando]
```

| Comando                            | O que faz                                             |
| ---------------------------------- | ----------------------------------------------------- |
| [`new <nome>`](#prumo-new)         | Cria um app React organizado em camadas               |
| [`make:schema <domínio>`](#prumo-makeschema) | Cria o schema (zod) de uma entidade, com os campos |
| [`make:repository <domínio>`](#prumo-makerepository) | Cria o repositório de um domínio (contrato, mock e teste de contrato) e acrescenta fontes (`http`, `storage`) |
| [`check`](#prumo-check)            | Confere a arquitetura do projeto                      |

## Como rodar

Num app do Prumo, a CLI é dependência de desenvolvimento:

```bash
pnpm exec prumo --help
```

Sem instalar nada:

```bash
pnpm dlx @matizze/prumo-cli --help
```

## `prumo new`

```text
prumo new <nome> [--dir <pasta>] [--no-install] [--packages <pasta>] [--dry-run]
```

Cria `<dir>/<nome>`: um app com Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next, os pacotes do Prumo (`core`, `rules`, `testing` e `cli`), a estrutura de pastas das camadas, os provedores (query, i18n e repositórios), a tela inicial `home` (a mesma que o `make:page` gera, na rota `/`), o `src/vite-env.d.ts` (com `VITE_DATA_SOURCE` e `VITE_API_URL`, opcionais), o ESLint com o plugin do Prumo, o Vitest com jsdom e o `AGENTS.md`. A fonte de dados padrão é `mock`. Veja o app criado em [Anatomia do app gerado](../concepts/generated-app.md).

| Argumento ou opção  | O que faz                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `<nome>`            | O nome do app, em kebab-case (`meu-app`): a pasta e o `name` do `package.json`                                               |
| `--dir <pasta>`     | A pasta onde criar `<nome>` (padrão: a pasta atual; a que falta é criada)                                                    |
| `--no-install`      | Não roda o `pnpm install`: só cria os arquivos                                                                               |
| `--packages <pasta>` | Uma pasta com os tarballs dos pacotes `@matizze/prumo-*` (os do `pnpm pack:all`), instalados no lugar do registry, por `pnpm.overrides` com `file:` |
| `--dry-run`         | Lista o que seria criado e não escreve nada                                                                                  |

O que o comando faz, nesta ordem:

1. Confere tudo antes de escrever: o nome (kebab-case, até 214 caracteres), a pasta de destino (`<dir>/<nome>` não pode existir com conteúdo; uma pasta vazia serve) e os tarballs de `--packages` (a pasta precisa ter o tarball dos quatro pacotes). Qualquer problema sai com código `2`, sem deixar nada pela metade.
2. Monta o plano do app inteiro e só então o grava.
3. Roda `git init` (sem commit: o primeiro commit é seu).
4. Roda `pnpm install`, a não ser com `--no-install`. Se o `pnpm install` falha, o comando sai com `1` e o app fica criado.
5. Escreve os próximos passos (`pnpm verify`, `pnpm dev`, `prumo make:page`).

O `package.json` do app tem os scripts `dev`, `build`, `typecheck`, `lint`, `check`, `test` e `verify`, e fixa o pnpm em `packageManager` (`pnpm@<versão>`, lida do pnpm que rodou o comando; sem versão, o campo fica de fora). Os pacotes do Prumo entram como `^<versão>`.

## `prumo make:schema`

```text
prumo make:schema <domínio> [--entity <singular>] [--fields <campos>] [--root <pasta>] [--dry-run]
```

Cria o schema zod de uma entidade e o registra:

- `src/schemas/entities/<entidade>.ts`, com o `<entidade>Schema` (`id`, os campos e `createdAt`), o `<Entidade>Schema` (o tipo), o `<entidade>InputSchema` e o `<Entidade>Input` (o que se envia para criar ou editar), o `<Entidade>SortKey` e o `<Entidade>ListQuery`;
- `export * from './entities/<entidade>'` no fim de `src/schemas/index.ts`.

O `<domínio>` é o nome do domínio, no plural e em kebab-case (`clientes`, `pedidos-recentes`). A entidade é o singular, que sai do nome (tira o `s` final). Só o `s` final sai: `fornecedores` dá `fornecedore`, e `paes` dá `pae`. A saída mostra a entidade derivada, e o `--entity` a troca (`--entity fornecedor`, `--entity pao`). Onde a regra erra (o plural termina em `ies`, `us`, `ss`, `xes`, `ches`, `shes` ou `sses`), o comando recusa e pede o `--entity`: `categories` daria `categorie`, e o certo é `--entity category`.

| Opção                 | O que faz                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `--entity <singular>` | A entidade, no singular (`paes` com `--entity pao`). Padrão: o nome sem o `s` final        |
| `--fields <campos>`   | Os campos da entidade (formato abaixo). Padrão: só `name:string`                           |
| `--root <pasta>`      | A pasta do projeto, a que tem o `src` (padrão: a pasta atual)                              |
| `--dry-run`           | Lista o que seria criado e alterado, sem escrever nada                                     |

### O formato do `--fields`

`nome:tipo` separados por vírgula:

```bash
prumo make:schema livros --fields "titulo:string,ano:int,situacao:enum(lido|lendo|desejado),lidoEm?:datetime,apelido?:string"
```

| Tipo           | Vira no schema          | Observação                                                      |
| -------------- | ----------------------- | --------------------------------------------------------------- |
| `string`       | `z.string()`            | Texto                                                           |
| `number`       | `z.number()`            | Número qualquer                                                 |
| `int`          | `z.number().int()`      | Número inteiro                                                  |
| `boolean`      | `z.boolean()`           |                                                                 |
| `date`         | `z.iso.date()`          | Data, `AAAA-MM-DD`                                              |
| `datetime`     | `z.iso.datetime()`      | Data e hora em ISO, `2026-01-05T12:00:00.000Z`                  |
| `enum(a\|b\|c)` | `z.enum(['a', 'b', 'c'])` | Um valor da lista: dois ou mais, letras, números e `_`, começando por letra |

- O nome do campo é camelCase: começa com letra minúscula e tem só letras e números.
- O `?` depois do nome torna o campo opcional (`apelido?:string` vira `z.string().optional()`).
- `id` e `createdAt` são reservados (o repositório os dá a todo registro), e um nome repetido é recusado.
- Espaços em volta dos nomes e dos tipos são aceitos.

O comando valida tudo antes de escrever: o nome (kebab-case, no plural, sem palavra reservada do JavaScript nem nome global como `Date`), a entidade, cada campo e o schema que já existe (nunca sobrescreve). Qualquer erro sai com 2, em português, sem deixar nada pela metade. No fim, mostra o que criou e alterou e o próximo passo: `prumo make:repository <domínio>`.

Quem lê os campos depois é o `make:repository`, direto do schema gerado. O leitor lê a árvore do arquivo (o enum pode ter várias linhas e vírgula no fim) e exige o que o `--fields` geraria: `id` e `createdAt` como `z.string()`, nomes de campo em camelCase sem aspas e enum com dois valores ou mais, simples e sem repetição. Um campo que o Prumo não reconhece (o schema foi editado à mão com outro tipo, como `z.string().min(3)`) é erro de uso, com o arquivo, a linha e o nome do campo.

## `prumo make:repository`

```text
prumo make:repository <domínio> [--entity <singular>] [--data-source <mock|http|storage>] [--root <pasta>] [--dry-run]
```

Cria o repositório do domínio com a fonte `mock` e o registra; com `--data-source http` ou `storage`, acrescenta também uma fonte de dados (veja [Fontes de dados](#fontes-de-dados)). Precisa do schema (`prumo make:schema`): os campos (busca, ordem, dados de exemplo e teste de contrato) saem do schema gerado, lido da árvore do arquivo, e por isso o comando não tem `--fields`. Um campo que o Prumo não reconhece (veja o fim da seção do `make:schema`) é erro de uso, com a linha do campo.

O comando também lê, do mesmo arquivo, o `.pick` do `<entidade>InputSchema` e os membros do `<Entidade>SortKey`: o `create`, o `update` e os dados de entrada do teste usam só os campos do `pick`, e os acessores de ordem e o teste de ordem só os da `SortKey`. Assim, um campo acrescentado à mão só ao `z.object` (ou tirado do `pick`, como um campo calculado pelo backend) gera um repositório que compila; o campo fora do `pick` recebe um valor de exemplo no mock. Só o `.pick({ campo: true, ... })` é aceito: um `<entidade>InputSchema` escrito com `.omit({ ... })` é erro de uso, e se reescreve listando no `.pick` os campos que sobram. A `SortKey` não pode ter campo booleano (o `--fields` também não ordena por booleano). Um `pick` ou uma `SortKey` que o comando não lê, ou com nome que não é campo, é erro de uso, com a linha.

- `src/repositories/<domínio>/repository.contract.ts`: o `I<Domínio>Repository`, o contrato único de todas as fontes (`list`, `get`, `create`, `update` e `remove`; id que não existe rejeita com `UIError('<ENTIDADE>_NOT_FOUND')`);
- `repository.mock.ts`: o `Mock<Domínio>Repository`, em memória, com latência simulada (300 ms; o teste usa 0). A busca olha os campos de texto, e a ordem aceita todos os campos, menos os booleanos, e o `createdAt`;
- `fixtures.ts`: três registros de exemplo, com valores coerentes com o tipo de cada campo;
- `repository.contract.test.ts`: o teste de contrato, que roda contra o mock;
- `index.ts`: a fábrica `create<Domínio>Repository`, que devolve o mock.

Também altera:

- `src/repositories/index.ts` (o container): o `import` da fábrica, o `export *` da pasta e a entrada no mapa `factories`, cada um em ordem alfabética;
- `src/messages/<idioma>/errors.json` de cada idioma: o texto de `<ENTIDADE>_NOT_FOUND` (`CLIENTE_NOT_FOUND`), para a tela mostrar a mensagem do erro e não a genérica. A chave que já existe não é trocada, e num app sem o `errors.json` o comando avisa e segue.

O `<domínio>` e o `--entity` são os do `make:schema`: se o schema saiu com `--entity pao`, o repositório também leva `--entity pao`.

| Opção                 | O que faz                                                                           |
| --------------------- | ----------------------------------------------------------------------------------- |
| `--entity <singular>` | A entidade, no singular, a mesma do `make:schema`. Padrão: o nome sem o `s` final   |
| `--data-source <fonte>` | `mock` (padrão), `http` ou `storage`. Outro valor sai com 2                       |
| `--root <pasta>`      | A pasta do projeto, a que tem o `src` (padrão: a pasta atual)                       |
| `--dry-run`           | Lista o que seria criado e alterado, sem escrever nada                              |

O comando valida tudo antes de escrever e nunca sobrescreve. Saem com 2, sem deixar nada pela metade: a fonte que não existe (`--data-source graphql`), a fonte que o repositório já tem, o schema que falta (a mensagem traz o `prumo make:schema` com o `--entity` certo e, se há schemas sem repositório, lembra de repetir o `--entity` e lista os nomes deles), o repositório que já existe (sem `--data-source`, ou com `mock`), um campo do schema que não se lê e um container (`src/repositories/index.ts`) sem o mapa `factories`. No fim, mostra o que criou e alterou e o próximo passo: `prumo make:query <domínio>`.

### Fontes de dados

O contrato (`I<Domínio>Repository`) é o formato único, e todas as fontes o implementam; o teste de contrato prova que elas se comportam igual. O app escolhe a fonte pela variável `VITE_DATA_SOURCE` (`mock` quando falta; um valor fora de `DATA_SOURCES` lança erro na inicialização), e a fábrica do domínio devolve a implementação da fonte, ou o mock quando o domínio não tem a fonte.

- Sem `--data-source` (ou com `mock`): o comportamento de cima. O repositório que já existe sai com 2.
- Com `http` ou `storage`: se o repositório não existe, o comando cria o repositório completo (com o mock) e acrescenta a fonte; se já existe, acrescenta só a fonte. A fonte que já existe (`repository.<fonte>.ts`) sai com 2.

Cada fonte acrescentada:

- cria `repository.<fonte>.ts`;
- acrescenta a fonte ao `DATA_SOURCES` de `src/repositories/options.ts`, se ainda não está lá;
- acrescenta à fábrica `src/repositories/<domínio>/index.ts` o import, o export da classe e a linha `if (dataSource === '<fonte>') return new ...`, antes do `return` do mock (a fábrica passa a receber `{ dataSource, latencyMs }`);
- acrescenta ao `repository.contract.test.ts` uma chamada do `runContractSuite` para a fonte.

| Fonte     | Arquivo                 | Como funciona                                                                                                                                                                                       |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock`    | `repository.mock.ts`    | Em memória, com as fixtures e latência simulada. É a padrão e a dos testes.                                                                                                                         |
| `storage` | `repository.storage.ts` | A classe `Storage<Domínio>Repository`: o mock gravando no `localStorage`, com a chave `<nome do app>:<domínio>` (o nome é o `name` do `package.json`). Começa com as fixtures, aceita `latencyMs` e usa a mesma busca, ordem e paginação do mock. O teste de contrato limpa a chave antes de cada repositório novo. |
| `http`    | `repository.http.ts`    | A classe `Http<Domínio>Repository`: `fetch` na API pelo cliente `src/repositories/http.ts`. O backend responde no formato do app (`{ items, total }`, com os campos do schema) e o repositório só valida cada resposta com o schema, sem traduzir formato. A lista envia `search`, `sort=<campo>:<asc\|desc>`, `page` e `page_size`; o id vai codificado na URL; o `update` é `PATCH` (o contrato aceita `Partial<Input>`); o 404 vira `UIError('<ENTIDADE>_NOT_FOUND')`. |

Na primeira fonte `http` do app, o comando cria também `src/repositories/http.ts` (o cliente, com `createHttp`, `HttpError` e o tipo `Http`), `src/repositories/api.ts` (a instância, com `import.meta.env.VITE_API_URL ?? '/api'` e o lugar comentado do token da sessão) e `src/vite-env.d.ts`, se faltar. Das vezes seguintes, reaproveita os que já existem. O contrato do `http` só roda com uma API de teste (`API_TEST_URL`); sem ela fica pulado, com o motivo no título. O guia [Ligar uma API real](../guides/real-api.md) mostra o `.env`, o token e o teste contra uma API de teste.

## `prumo check`

```text
prumo check [--root <pasta>]
```

Analisa o projeto com o `@matizze/prumo-rules/check` e escreve uma violação por linha, no stderr:

```text
src/components/widgets  [components-folders]  A pasta 'widgets' não é permitida em src/components
```

Confere as pastas de `src/components`, o uso de `components/shared` pelas telas, a estrutura de cada tela e os textos completos nos idiomas. Sem violação, escreve `prumo check: nenhuma violação.`.

| Opção             | O que faz                                                     |
| ----------------- | ------------------------------------------------------------- |
| `--root <pasta>`  | A pasta do projeto, a que tem o `src` (padrão: a pasta atual) |

| Código | Quando                                                                          |
| ------ | ------------------------------------------------------------------------------- |
| `0`    | Nenhuma violação                                                                |
| `1`    | Há violação                                                                     |
| `2`    | A pasta não existe ou não é um projeto (sem `package.json` e `src`)             |

## Opções globais

| Opção             | O que faz           |
| ----------------- | ------------------- |
| `-v, --version`   | Mostra a versão.    |
| `-h, --help`      | Mostra esta ajuda.  |

`prumo` sem argumentos mostra a ajuda. Não há o subcomando `help`: use `prumo <comando> --help` para a ajuda de um comando.

## A ajuda

A ajuda é toda em português, com os cabeçalhos `Uso:`, `Argumentos:`, `Opções:` e `Comandos:`:

```text
Uso: prumo [opções] [comando]

Prumo, a ferramenta da Matizze que cria e confere a arquitetura de apps React.

Opções:
  -v, --version        Mostra a versão.
  -h, --help           Mostra esta ajuda.

Comandos:
  new [opções] <nome>             Cria um app React mínimo do Prumo, sem CSS e
                                  sem design system.
  make:schema [opções] <domínio>  Cria o schema (zod) de uma entidade, com os
                                  campos.
  check [opções]                  Analisa o projeto e lista as violações da
                                  arquitetura.
```

## Códigos de saída

| Código | Quando                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------- |
| `0`    | Sem erro, inclusive `--help`, `--version` e `prumo` sem argumentos                                       |
| `1`    | Erro inesperado (a pilha vai para o stderr) ou, nos comandos que o definem, o resultado do comando (`check` com violação; `new` com o `pnpm install` que falhou) |
| `2`    | Uso errado: comando ou opção desconhecidos, argumento que falta ou a mais, opção sem valor, valor inválido |

No uso errado, o stderr traz a mensagem em português, no formato `prumo: opção desconhecida: '--x'.`, seguida da ajuda do comando:

```text
$ prumo --x
prumo: opção desconhecida: '--x'.

Uso: prumo [opções]
...
```

Quando há um nome parecido, a mensagem sugere: `prumo: comando desconhecido: 'mak'. Você quis dizer make:page?`.
