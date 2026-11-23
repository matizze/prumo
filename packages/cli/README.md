# @matizze/prumo-cli

O comando `prumo`: cria apps React organizados em camadas e confere a arquitetura. Parte do [Prumo](https://github.com/matizze/prumo).

**[Documentação](https://github.com/matizze/prumo/blob/main/docs/README.md)** · **[Primeiros passos](https://github.com/matizze/prumo/blob/main/docs/getting-started.md)** · **[Referência da CLI](https://github.com/matizze/prumo/blob/main/docs/reference/cli.md)** · **[Changelog](https://github.com/matizze/prumo/blob/main/packages/cli/CHANGELOG.md)**

## Instalação

Requer Node.js 24 e pnpm:

```bash
pnpm add -D @matizze/prumo-cli
```

## Uso

A CLI está sendo reescrita com o commander, um comando por vez. Por enquanto ela tem a ajuda, a versão e os comandos `new` (cria um app) e `check` (confere a arquitetura); os `make:schema`, `make:repository`, `make:query` e `make:page` voltam nas próximas versões.

```bash
pnpm exec prumo --help       # a ajuda, em português
pnpm exec prumo --version    # a versão
pnpm exec prumo new <nome>   # cria um app
pnpm exec prumo check        # confere a arquitetura
```

Códigos de saída: `0` sucesso, `1` erro inesperado (ou violação, no `check`) e `2` uso errado (comando, opção ou argumento que não existe). A ajuda e as mensagens são em português.

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues).
