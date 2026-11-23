# Referência da CLI

O comando `prumo`, do pacote [`@matizze/prumo-cli`](https://www.npmjs.com/package/@matizze/prumo-cli).

> **Os comandos estão sendo reescritos.** A CLI foi refeita com o commander, e os comandos voltam um a um nas próximas versões. Por enquanto ela tem o `new`, o `check`, a ajuda, a versão e os códigos de saída descritos aqui.

```text
prumo [opções] [comando]
```

| Comando                            | O que faz                                             |
| ---------------------------------- | ----------------------------------------------------- |
| [`new <nome>`](#prumo-new)         | Cria um app React organizado em camadas               |
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

Cria `<dir>/<nome>`: um app com Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next, os pacotes do Prumo (`core`, `rules`, `testing` e `cli`), a estrutura de pastas das camadas, os provedores (query, i18n e repositórios), a tela inicial `home` (a mesma que o `make:page` gera, na rota `/`), o ESLint com o plugin do Prumo, o Vitest com jsdom e o `AGENTS.md`. A fonte de dados padrão é `mock`. Veja o app criado em [Anatomia do app gerado](../concepts/generated-app.md).

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
  new [opções] <nome>  Cria um app React mínimo do Prumo, sem CSS e sem design
                       system.
  check [opções]       Analisa o projeto e lista as violações da arquitetura.
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
