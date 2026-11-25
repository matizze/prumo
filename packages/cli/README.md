# @matizze/prumo-cli

O comando `prumo`: cria apps React organizados em camadas e confere a arquitetura. Parte do [Prumo](https://docs.prumo.matizze.com.br).

**[Documentação](https://docs.prumo.matizze.com.br)** · **[Primeiros passos](https://docs.prumo.matizze.com.br/getting-started)** · **[Referência da CLI](https://docs.prumo.matizze.com.br/reference/cli)**

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
pnpm exec prumo make:usecase clientes --crud                       # os cinco use cases do CRUD, com mock e teste
pnpm exec prumo make:page clientes --usecase clientes.list-clientes  # a tela que lista
pnpm exec prumo check                                              # confere a arquitetura
```

| Comando                                                                    | O que faz                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `prumo new <nome>`                                                         | Cria o app (`--dir`, `--no-install`, `--packages`)                        |
| `prumo make:schema <domínio> [--entity] [--fields]`                        | Cria o schema zod de uma entidade, com os campos                          |
| `prumo make:usecase <domínio.ação> [--input] [--output] [--endpoint] [--local]` | Cria um use case (tipos, classe, mock e teste) e o registra; com `<domínio> --crud [--entity]`, os cinco do CRUD |
| `prumo make:page <nome> [--usecase <domínio.ação>] [--path <caminho>]`     | Cria a tela (index, model, view, teste), os textos e a rota; com `--usecase`, lista, detalhe ou formulário |
| `prumo check`                                                              | Confere a arquitetura do projeto                                          |
| `prumo list [--json]`                                                      | Mostra o que o projeto tem (schemas, use cases, telas, idiomas) |
| `prumo mcp`                                                                | Abre o servidor MCP do projeto, por stdio, para agentes de IA              |

O `new` e os `make:*` aceitam `--dry-run` (o `check` e o `list` só leem), todos validam tudo antes de escrever, e os `make:*`, o `check` e o `list` aceitam `--root <pasta>` (o `new` tem `--dir`). Nenhum sobrescreve arquivo. `pnpm exec prumo --help` e `prumo <comando> --help` mostram a ajuda, em português.

Códigos de saída: `0` sucesso, `1` erro inesperado (ou violação, no `check`) e `2` uso errado (comando, opção ou argumento que não existe). A ajuda e as mensagens são em português.

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues). Licença MIT.
