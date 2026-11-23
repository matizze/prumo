# Referência da CLI

O comando `prumo`, do pacote [`@matizze/prumo-cli`](https://www.npmjs.com/package/@matizze/prumo-cli).

> **Os comandos estão sendo reescritos.** A CLI foi refeita com o commander, e os comandos voltam um a um nas próximas versões. Por enquanto ela tem a ajuda, a versão e os códigos de saída descritos aqui.

```text
prumo [opções] [comando]
```

## Como rodar

Num app do Prumo, a CLI é dependência de desenvolvimento:

```bash
pnpm exec prumo --help
```

Sem instalar nada:

```bash
pnpm dlx @matizze/prumo-cli --help
```

## Opções globais

| Opção             | O que faz           |
| ----------------- | ------------------- |
| `-v, --version`   | Mostra a versão.    |
| `-h, --help`      | Mostra esta ajuda.  |

`prumo` sem argumentos mostra a ajuda. Não há o subcomando `help`: use `prumo <comando> --help` para a ajuda de um comando.

## A ajuda

A ajuda é toda em português, com os cabeçalhos `Uso:`, `Argumentos:`, `Opções:` e `Comandos:`:

```text
Uso: prumo [opções]

Prumo, a ferramenta da Matizze que cria e confere a arquitetura de apps React.

Opções:
  -v, --version  Mostra a versão.
  -h, --help     Mostra esta ajuda.
```

## Códigos de saída

| Código | Quando                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------- |
| `0`    | Sem erro, inclusive `--help`, `--version` e `prumo` sem argumentos                                       |
| `1`    | Erro inesperado (a pilha vai para o stderr) ou, nos comandos que o definem, o resultado do comando       |
| `2`    | Uso errado: comando ou opção desconhecidos, argumento que falta ou a mais, opção sem valor, valor inválido |

No uso errado, o stderr traz a mensagem em português, no formato `prumo: opção desconhecida: '--x'.`, seguida da ajuda do comando:

```text
$ prumo --x
prumo: opção desconhecida: '--x'.

Uso: prumo [opções]
...
```

Quando há um nome parecido, a mensagem sugere: `prumo: comando desconhecido: 'mak'. Você quis dizer make:page?`.
