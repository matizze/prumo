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

Cada regra olha só os arquivos da pasta que protege e deixa os demais passarem, então a config `recommended` vale para o projeto inteiro.

| Regra               | O que cobra                                                                                                                                                                                                | Opções                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `prumo/ui-boundary` | O design system (`src/components/ui`) não conhece o app: importa dele mesmo, das pastas permitidas do app (`@/icons`, `@/lib/utils`, `@/hooks/use-mobile`) e de pacotes npm, menos os proibidos (`wouter`) | `alias`, `aliasRoot`, `designSystemDir`, `allow` (permitidos do app) e `forbidPackages` (proibidos) |

## Código-fonte

- `src/eslint/`: o plugin e as regras, cada uma com o teste ao lado (`RuleTester` do ESLint).

**Origem no app de referência:** `src/architecture.test.ts` e as regras de import do `eslint.config.js`.
