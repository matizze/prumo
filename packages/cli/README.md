# @matizze/prumo-cli

O comando `prumo`: cria apps React organizados em camadas, gera telas, domínios de dados e componentes a partir de modelos, e confere a arquitetura. Parte do [Prumo](https://github.com/matizze/prumo).

**[Documentação](https://github.com/matizze/prumo/blob/main/docs/README.md)** · **[Primeiros passos](https://github.com/matizze/prumo/blob/main/docs/getting-started.md)** · **[Referência da CLI](https://github.com/matizze/prumo/blob/main/docs/reference/cli.md)** · **[Changelog](https://github.com/matizze/prumo/blob/main/packages/cli/CHANGELOG.md)**

## Instalação

Para criar um app, sem instalar nada antes (requer Node.js 24 e pnpm):

```bash
pnpm dlx @matizze/prumo-cli new meu-app
```

O app criado já tem a CLI como dependência de desenvolvimento (`pnpm exec prumo ...`). Num projeto existente:

```bash
pnpm add -D @matizze/prumo-cli
```

## Uso

```bash
pnpm dlx @matizze/prumo-cli new loja      # app com Vite, React 19, TanStack Query, zod e i18next
cd loja
pnpm exec prumo make:domain clientes       # schema, contrato, repositório em memória, queries e teste
pnpm exec prumo make:page clientes --domain clientes   # tela que lista o domínio, textos e rota
pnpm exec prumo make:component resumo --page clientes  # componente da tela e o teste
pnpm exec prumo check                      # análise da arquitetura
pnpm verify                                # typecheck, lint, testes e check
```

| Comando                                                   | O que faz                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `prumo new <nome>`                                        | Cria um app mínimo, sem CSS e sem design system, com a estrutura, os provedores, uma tela inicial, ESLint, Vitest, `AGENTS.md` e `.mcp.json` |
| `prumo make:page <nome> [--domain <domínio>] [--path <caminho>]` | Gera index, model, view, teste, os textos nos idiomas do projeto e a rota                  |
| `prumo make:domain <nome> [--entity <singular>]`          | Gera schema, contrato, mock com fixtures, queries e o teste de contrato, e registra o domínio |
| `prumo make:component <nome> (--page <tela> \| --shared)`  | Gera um componente (só HTML) e o teste                                                     |
| `prumo check`                                             | Lista as violações da arquitetura                                                          |
| `prumo doctor`                                            | Confere Node, pnpm, a versão dos pacotes do Prumo e o `.mcp.json`                         |

Os geradores validam tudo antes de escrever, nunca sobrescrevem e aceitam `--dry-run`; os `make:*` aceitam `--root <pasta>` e rodam o `prumo check` no fim. Códigos de saída: `0` sucesso, `1` violação ou erro, `2` uso errado. `prumo <comando> --help` mostra a ajuda completa, em português.

## API em processo

`@matizze/prumo-cli/api` roda e descreve os comandos sem subprocesso (é o que o servidor MCP usa):

```ts
import { runInProcess } from '@matizze/prumo-cli/api'

const { exitCode, stdout, stderr } = await runInProcess(['check'], { cwd: '/caminho/do/app' })
```

Veja a [referência da CLI](https://github.com/matizze/prumo/blob/main/docs/reference/cli.md#api-em-processo).

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues).
