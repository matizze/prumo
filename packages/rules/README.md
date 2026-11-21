# @matizze/prumo-rules

Regras da arquitetura do Prumo: plugin de ESLint, com aviso no editor, e análise do projeto inteiro para o prumo check.

**Situação:** Fase 1, em extração do app de referência (`apps/reference`), um módulo por pull request. O plano está em [docs/fase-1.md](../../docs/fase-1.md).

## Plugin de ESLint

`@matizze/prumo-rules/eslint` exporta o plugin. O pacote entrega o código-fonte em TypeScript, então o `eslint.config.js` precisa de um Node que execute `.ts` (Node 24 ou mais novo). O `eslint` é peer dependency, na faixa `^10.13.0`.

```js
import prumo from '@matizze/prumo-rules/eslint'

export default [
  // Liga todas as regras da tabela abaixo, com as opções padrão
  prumo.configs.recommended,
]
```

Para mudar as opções de uma regra, registre o plugin com o nome `prumo` e configure a regra:

```js
export default [
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { prumo },
    rules: {
      'prumo/ui-boundary': ['error', { designSystemDir: 'src/design-system' }],
    },
  },
]
```

### Regras

Cada regra olha só os arquivos que protege (uma pasta, ou o projeto menos a pasta de ícones) e deixa os demais passarem, então a config `recommended` vale para o projeto inteiro.

| Regra                        | O que cobra                                                                                                                                                                                                 | Opções                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `prumo/ui-boundary`          | O design system (`src/components/ui`) não conhece o app: importa dele mesmo, das pastas permitidas do app (`@/icons`, `@/lib/utils`, `@/hooks/use-mobile`) e de pacotes npm, menos os proibidos (`wouter`)  | `alias`, `aliasRoot`, `designSystemDir`, `allow` (permitidos do app) e `forbidPackages` (proibidos) |
| `prumo/icons-from-alias`     | Ícone só da pasta de ícones: fora de `src/icons`, nada de importar arquivo `.svg` nem biblioteca de ícones (`lucide-react`, `react-icons`, `@heroicons/*`, `@tabler/icons-react` e `@phosphor-icons/react`) | `iconsDir`, `iconsImport` (só para a mensagem) e `libraries` (a lista de bibliotecas proibidas)     |
| `prumo/no-cross-page-import` | Uma tela não importa da pasta de outra: um arquivo de `src/pages/<tela>/` não importa de `src/pages/<outra>/`, nem pelo alias nem por caminho relativo                                                      | `alias`, `aliasRoot` e `pagesDir` (a pasta das telas)                                               |
| `prumo/no-inline-svg`        | Nenhum SVG solto nas telas: o elemento `<svg>` em JSX dentro de `src/pages/**/*.tsx` vira um ícone da pasta de ícones                                                                                       | `pagesDir` (a pasta das telas) e `iconsImport` (só para a mensagem)                                 |
| `prumo/page-structure`       | Toda tela tem a mesma estrutura: o `index.tsx` de `src/pages/<tela>/` tem ao lado o `model.ts` e a `view.tsx`. O `skeleton.tsx` não é cobrado (só o registry o cobra, nas telas publicadas)                 | `pagesDir` (a pasta das telas) e `requiredFiles` (os arquivos cobrados)                             |

## Código-fonte

- `src/eslint/`: o plugin e as regras, cada uma com o teste ao lado (`RuleTester` do ESLint).

**Origem no app de referência:** `src/architecture.test.ts` e as regras de import do `eslint.config.js`.
