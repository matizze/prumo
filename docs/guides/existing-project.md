# Projeto existente

O jeito mais simples de usar o Prumo é começar pelo `prumo new`. Mas um app React que já existe também pode adotá-lo, em partes. Este guia mostra três níveis de adoção, do mais leve ao completo.

| Nível                         | O que você ganha                                                    | O que o projeto precisa                                   |
| ----------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| 1. As regras                  | Aviso no editor e análise da arquitetura no `pnpm check`             | Telas em pastas, com `index`, `model` e `view`             |
| 2. A infraestrutura do core   | Container de repositórios, query keys, i18n tipado, erros com código | React, TanStack Query, zod, i18next e wouter               |
| 3. Os geradores               | `make:schema`, `make:repository`, `make:query` e `make:page`         | Os pontos de registro do app gerado                       |

Requisitos em qualquer nível: Node.js 24 ou mais novo e pnpm.

## Nível 1: as regras

Instale a análise e a CLI como dependências de desenvolvimento:

```bash
pnpm add -D @matizze/prumo-rules @matizze/prumo-cli
```

### O plugin de ESLint

No `eslint.config.js` (flat config, ESLint 10):

```js
import prumo from '@matizze/prumo-rules/eslint'

export default [
  // ... a configuração que o projeto já tem
  prumo.configs.recommended,
]
```

A config `recommended` liga `prumo/no-cross-page-import` e `prumo/page-structure` como erro, para arquivos `.ts` e `.tsx`. Cada regra só olha a pasta das telas, então ela vale para o projeto inteiro sem efeito no resto.

Se as telas não moram em `src/pages`, ou o alias não é `@/`, configure as regras:

```js
export default [
  prumo.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'prumo/page-structure': ['error', { pagesDir: 'src/screens' }],
      'prumo/no-cross-page-import': ['error', { pagesDir: 'src/screens', alias: '~/', aliasRoot: 'src' }],
    },
  },
]
```

Para adotar aos poucos, comece com `'warn'` no lugar de `'error'` e suba quando as telas estiverem em ordem.

### O `prumo check`

Acrescente o script e rode:

```json
{ "scripts": { "check": "prumo check" } }
```

```bash
pnpm check
```

O `prumo check` usa a estrutura padrão do Prumo: telas em `src/pages`, componentes em `src/components` (com `ui`, `shared` e `layout`), textos em `src/messages/<idioma>` (`pt-BR` e `en`) e o alias `@/` para `src`. Sem a pasta de mensagens, a análise de textos não roda.

> **Limitação conhecida:** a CLI ainda não lê um arquivo de configuração, então o `prumo check` não aceita outros caminhos. Para um projeto com outra estrutura, chame a análise pela API, com as opções do projeto, num script ou num teste:
>
> ```ts
> // scripts/check.ts (node scripts/check.ts, com o Node 24)
> import { check } from '@matizze/prumo-rules/check'
>
> const violations = check({
>   root: process.cwd(),
>   pagesDir: 'src/screens',
>   alias: '~/',
>   locales: ['pt-BR', 'en', 'es'],
> })
> for (const { file, rule, message } of violations) console.log(`${file}  [${rule}]  ${message}`)
> process.exitCode = violations.length > 0 ? 1 : 0
> ```
>
> Todas as opções estão na [referência do rules](../reference/rules.md#opções-da-análise).

### Arrumar o que as regras acusam

- **Tela sem `model.ts` ou `view.tsx`:** separe o que é dado e texto (o model, um hook) do que é apresentação (a view, que recebe o model por props). O `index.tsx` só liga os dois.
- **Import entre telas:** mova o que as duas usam para `src/components/shared`.
- **Pasta fora do permitido em `src/components`:** distribua os componentes entre `ui` (design system), `shared` (do produto, usados por duas telas ou mais) e `layout` (a casca), ou mova-os para a tela que os usa.
- **Componente de `shared` usado por uma tela só:** mova-o para `src/pages/<tela>/components/`.

## Nível 2: a infraestrutura do core

```bash
pnpm add @matizze/prumo-core
pnpm add -D @matizze/prumo-testing
```

O core é dividido por módulo, e cada um tem um subcaminho próprio: importar o i18n não traz o container de repositórios. Adote o que fizer sentido:

| Módulo                               | Para                                                                 | Guia                                                  |
| ------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------- |
| `@matizze/prumo-core/repositories`   | Container de repositórios por domínio, com troca nos testes          | [Domínios de dados](domains.md)                       |
| `@matizze/prumo-core/query`          | Query keys por domínio e `QueryClient` com notificação de erro       | [Erros e notificações](errors-and-notifications.md)   |
| `@matizze/prumo-core/i18n`           | i18n tipado pelas mensagens, com ICU e formatadores                  | [Textos e idiomas](i18n.md)                           |
| `@matizze/prumo-core/errors`         | `UIError` e a tradução do código do erro                             | [Erros e notificações](errors-and-notifications.md)   |
| `@matizze/prumo-core/data`, `/mock`  | Tipos de página e ordenação, utilitários de repositório em memória   | [Referência do core](../reference/core.md)            |
| `@matizze/prumo-core/auth`           | Guarda de rota                                                       | [Telas](pages.md#rotas-protegidas)                    |

As dependências do core (React 19, TanStack Query 5, zod 4, i18next 26, react-i18next, `i18next-icu`, `i18next-browser-languagedetector` e wouter 3) são *peer dependencies*: o projeto instala as que usa.

## Nível 3: os geradores

Os geradores criam arquivos que importam módulos do app (`@/i18n`, `@/test/render`, `@/providers/repository`) e editam alguns arquivos de registro (o `App.tsx`, os índices de mensagens, de schemas, de queries e de repositórios). A lista completa, com a forma que cada um precisa ter, está em [Anatomia do app gerado](../concepts/generated-app.md#pontos-de-registro).

O caminho mais curto para ter esses pontos num projeto existente:

1. Crie um app de referência numa pasta temporária: `pnpm dlx @matizze/prumo-cli new referencia --no-install`.
2. Copie para o seu projeto o que faltar: `src/i18n.ts`, `src/providers/`, `src/repositories/index.ts` e `options.ts`, `src/schemas/index.ts`, `src/queries/index.ts`, `src/test/` e as pastas `src/messages/<idioma>/` com o `index.ts`.
3. Ajuste o `App.tsx` para ter um `<Switch>` do wouter com as rotas, e o alias `@/` no `tsconfig.json` e no `vite.config.ts`.
4. Rode um gerador com `--dry-run` para ver o que ele faria: se um ponto de registro falta ou tem outra forma, ele recusa com a explicação e código de saída 2, sem escrever nada.

```bash
pnpm exec prumo make:schema clientes --dry-run
```

Os geradores supõem o wouter como roteador e o `@/` como alias; projetos com outro roteador podem adotar os níveis 1 e 2 e escrever as telas à mão, seguindo a mesma estrutura.

## Conferir a versão

```bash
pnpm exec prumo --version
```

O `prumo check` (nível 1) é a conferência do dia a dia: ele sai com 1 quando acha violação. Os pacotes do Prumo versionam separados; mantenha-os numa faixa compatível com a da CLI (o `package.json` de um app criado pelo `new` já traz as quatro, com `^<versão>`).
