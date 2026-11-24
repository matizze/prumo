# @matizze/prumo-cli

O comando `prumo`: cria apps React organizados em camadas e confere a arquitetura. Parte do [Prumo](https://github.com/matizze/prumo).

**[Documentação](https://github.com/matizze/prumo/blob/main/docs/README.md)** · **[Primeiros passos](https://github.com/matizze/prumo/blob/main/docs/getting-started.md)** · **[Referência da CLI](https://github.com/matizze/prumo/blob/main/docs/reference/cli.md)** · **[Changelog](https://github.com/matizze/prumo/blob/main/packages/cli/CHANGELOG.md)**

## Instalação

Requer Node.js 24 e pnpm:

```bash
pnpm add -D @matizze/prumo-cli
```

## Uso

Do app novo a uma tela com dados, cada camada tem o seu comando:

```bash
pnpm dlx @matizze/prumo-cli new meu-app                            # cria o app
cd meu-app
pnpm exec prumo make:schema clientes --fields "nome:string,email:string"
pnpm exec prumo make:repository clientes                           # contrato, mock e teste de contrato
pnpm exec prumo make:query clientes                                # chaves, hooks de lista, detalhe e escrita
pnpm exec prumo make:page clientes --query clientes                # a tela que lista
pnpm exec prumo check                                              # confere a arquitetura
```

| Comando                                                                    | O que faz                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `prumo new <nome>`                                                         | Cria o app (`--dir`, `--no-install`, `--packages`)                        |
| `prumo make:schema <domínio> [--entity] [--fields]`                        | Cria o schema zod de uma entidade, com os campos                          |
| `prumo make:repository <domínio> [--entity] [--data-source mock\|http\|storage]` | Cria o repositório (contrato, mock, fixtures e teste) ou acrescenta uma fonte |
| `prumo make:query <domínio> [--entity]`                                    | Cria as queries e mutations (TanStack Query)                              |
| `prumo make:page <nome> [--query <domínio>] [--path <caminho>]`            | Cria a tela (index, model, view, teste), os textos e a rota               |
| `prumo check`                                                              | Confere a arquitetura do projeto                                          |
| `prumo list [--json]`                                                      | Mostra o que o projeto tem (schemas, repositórios, queries, telas, idiomas) |
| `prumo mcp`                                                                | Abre o servidor MCP do projeto, por stdio, para agentes de IA              |

O `new` e os `make:*` aceitam `--dry-run` (o `check` e o `list` só leem), todos validam tudo antes de escrever, e os `make:*`, o `check` e o `list` aceitam `--root <pasta>` (o `new` tem `--dir`). Nenhum sobrescreve arquivo. `pnpm exec prumo --help` e `prumo <comando> --help` mostram a ajuda, em português.

Códigos de saída: `0` sucesso, `1` erro inesperado (ou violação, no `check`) e `2` uso errado (comando, opção ou argumento que não existe). A ajuda e as mensagens são em português.

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues).
