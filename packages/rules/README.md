# @matizze/prumo-rules

As regras da arquitetura do [Prumo](https://github.com/matizze/prumo): um plugin de ESLint, que avisa no editor, e a análise do projeto inteiro que o `prumo check` roda. As regras cobram a estrutura (as camadas, as pastas e os textos), nunca a interface.

**[Documentação](https://github.com/matizze/prumo/blob/main/docs/README.md)** · **[Referência deste pacote](https://github.com/matizze/prumo/blob/main/docs/reference/rules.md)** · **[Changelog](https://github.com/matizze/prumo/blob/main/packages/rules/CHANGELOG.md)**

## Instalação

Um app criado pelo `prumo new` já tem o pacote e o plugin ligado. Num projeto existente:

```bash
pnpm add -D @matizze/prumo-rules
```

O `eslint` (^10.13) é *peer dependency* opcional: só o plugin precisa dele.

## Plugin de ESLint

```js
// eslint.config.js
import prumo from '@matizze/prumo-rules/eslint'

export default [
  // ... a configuração do projeto
  prumo.configs.recommended,
]
```

| Regra                        | O que cobra                                                                              | Opções                               |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| `prumo/no-cross-page-import` | Um arquivo de `src/pages/<tela>/` não importa de `src/pages/<outra>/`, pelo alias nem por caminho relativo | `alias`, `aliasRoot`, `pagesDir`     |
| `prumo/page-structure`       | O `index.tsx` de uma tela tem `model.ts` e `view.tsx` ao lado                            | `pagesDir`, `requiredFiles`          |

## Análise do projeto

```ts
import { check } from '@matizze/prumo-rules/check'

const violations = check({ root: process.cwd() })
// [{ rule: 'messages', file: 'src/messages/en/clientes.json', message: "A chave 'clientes.empty' existe em 'pt-BR' e falta em 'en'." }]
```

| Verificação          | O que cobra                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `components-folders` | `src/components` só tem as subpastas `ui`, `shared` e `layout`                                    |
| `shared-usage`       | O que está em `src/components/shared` é usado por duas telas ou mais (pelo grafo de imports)         |
| `page-structure`     | Toda pasta de `src/pages` tem `index.tsx`, `model.ts` e `view.tsx`                                 |
| `messages`           | Os idiomas têm as mesmas chaves e os mesmos argumentos ICU, nenhum texto vazio e os mesmos namespaces registrados |

As opções (pastas, alias, idiomas) e as mensagens de cada verificação estão em [docs/reference/rules.md](https://github.com/matizze/prumo/blob/main/docs/reference/rules.md).

## Suporte

Mantido pela [Matizze](https://github.com/matizze). Problemas e sugestões em [issues](https://github.com/matizze/prumo/issues).
