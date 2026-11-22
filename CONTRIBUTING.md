# Contribuindo com o Prumo

Obrigado pelo interesse. Este guia explica como montar o ambiente, as verificações que todo pull request passa, as convenções do código e da documentação e como uma mudança vira uma versão publicada.

O Prumo é mantido pela Matizze. O repositório é público para consulta, e o fluxo abaixo é o que o time segue. Para entender como os pacotes funcionam por dentro, leia [Como o Prumo funciona por dentro](docs/contributing/internals.md).

## O que é do Prumo

Antes de propor uma mudança, confira o critério que vale para qualquer decisão do projeto:

> **Se uma peça só faz sentido com uma interface específica, ela não é do Prumo.**

O Prumo gera a estrutura e confere a arquitetura de apps React. Ele não traz componente de interface, ícone, tema, CSS, Storybook, tela pronta, catálogo de blocos ou padrão de tela. O plano e as decisões estão em [docs/plan.md](docs/plan.md).

## Ambiente

Requisitos: **Node.js 24** (a versão está no `.nvmrc`) e **pnpm 10** (o `packageManager` da raiz).

```bash
git clone https://github.com/matizze/prumo.git
cd prumo
pnpm install
pnpm verify
```

No workspace, os pacotes exportam o código-fonte TypeScript, e o Node 24 o executa direto: não é preciso compilar para testar. Para rodar a CLI do workspace contra um app qualquer:

```bash
node packages/cli/src/bin.ts --help
node packages/cli/src/bin.ts new demo --dir /tmp --no-install
```

## Verificação

Não há CI de verificação: **a verificação é local**, e todo pull request passa por ela antes de abrir.

| Comando            | O que roda                                                                                                   | Quando                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `pnpm verify`      | Typecheck, lint e testes dos cinco pacotes, sem navegador (cerca de 1 minuto)                                | Sempre                                                       |
| `pnpm verify:new`  | Empacota os pacotes, cria um app numa pasta temporária, gera tela, domínio e componente pela CLI e pelo MCP e roda o `pnpm verify` do app | Ao mudar os modelos (`packages/cli/templates`), o `new`, os `make:*` ou o servidor MCP |
| `pnpm build`       | Compila os pacotes (`dist/`)                                                                                 | Para inspecionar o que vai para o npm                        |
| `pnpm pack:all`    | Compila e empacota os cinco pacotes em `.packs/`                                                             | Para testar um app com os tarballs (`prumo new --packages .packs`) |

Rode um comando pesado por vez: o `verify:new` instala dependências e roda `tsc`, `eslint` e `vitest` no app gerado, e em máquinas com pouca memória dois ao mesmo tempo atrapalham um ao outro.

## Fluxo de trabalho

1. Crie uma branch a partir da `develop` (`feat/...`, `fix/...`, `docs/...`).
2. Faça a mudança com os testes. Todo comportamento novo tem teste.
3. Se a mudança toca `packages/*`, crie um changeset (veja [Versões](#versões)).
4. Rode `pnpm verify` (e o `pnpm verify:new`, se couber).
5. Abra o pull request **contra a `develop`**. A `main` recebe só as versões.

### Commits

Mensagens em português, no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), com o escopo do pacote quando houver:

```text
feat(cli): prumo make:page aceita --domain
fix: o app do prumo new fixa o pnpm em packageManager
docs: guia de testes
chore: versões cli 0.5.1 e mcp 0.1.2
refactor!: regras sem interface
```

### Dependências

**Uma dependência nova só entra com aprovação de uma pessoa do time**, mesmo pequena. Descreva no pull request por que ela é necessária e o que foi considerado no lugar.

### Workflows

Os únicos workflows do GitHub são os de publicação: o `release.yml` (pacotes no npm) e o `docs.yml` (site da documentação). Não crie nem mude workflow sem aprovação.

## Convenções

- **Idioma.** Comentários, documentação, mensagens da CLI e commits em **português**. Nomes de função, variável, tipo e **arquivo** em **inglês** (inclusive os arquivos da documentação).
- **Formatação.** O `.prettierrc.json` e o `.editorconfig` registram o estilo: sem ponto e vírgula, aspas simples, vírgula no fim, 100 colunas, 2 espaços.
- **TypeScript estrito**, com `verbatimModuleSyntax` e `erasableSyntaxOnly`: `import type` para tipos, sem `enum`, `namespace` nem propriedades no construtor.
- **Sem saída direta no terminal** no código da CLI: os comandos escrevem pelo `Runtime` (o `no-leak.test.ts` cobra).
- **Mensagens para pessoas.** Erros dizem o que está errado e o que fazer, em português, com o nome do arquivo ou da opção.

### Documentação

A documentação mora em [`docs/`](docs/README.md) e segue quatro tipos de texto: tutorial, conceitos, guias e referência. Ao mudar um comportamento visível, atualize a referência correspondente e os guias que o usam. Os READMEs dos pacotes são a página de cada um no npm: curtos, com a instalação, o uso essencial e links para a documentação.

A mesma pasta vira o site [docs.prumo.matizze.com.br](https://docs.prumo.matizze.com.br), gerado pelo Docusaurus em `website/` (um projeto à parte, fora do workspace dos pacotes). Para ver o site enquanto escreve:

```bash
pnpm --dir website install --ignore-workspace
pnpm --dir website start     # http://localhost:3000, recarrega a cada mudança
pnpm --dir website build     # o build falha com link ou âncora quebrados
```

Links para arquivos fora de `docs/` (o CONTRIBUTING.md, o plano) viram, no site, links para o GitHub. O menu lateral fica em `website/sidebars.ts`: uma página nova entra lá.

## Versões

Os pacotes são versionados separadamente, com o [Changesets](https://github.com/changesets/changesets).

**Em todo pull request que muda `packages/*`:**

```bash
pnpm changeset
```

Escolha os pacotes, o tipo de versão e descreva a mudança **do ponto de vista de quem usa o pacote**, em português: a descrição vai para o `CHANGELOG.md`.

| Tipo    | Quando (os pacotes estão em `0.x`)                                     |
| ------- | ---------------------------------------------------------------------- |
| `patch` | Correção, documentação, mudança que não muda a API                     |
| `minor` | Funcionalidade nova ou mudança que quebra a compatibilidade            |

**Para lançar uma versão** (decisão de uma pessoa do time):

1. Um pull request para a `develop` roda `pnpm changeset version`: sobe as versões, escreve os CHANGELOGs e apaga os changesets. No mesmo pull request, atualize `packages/cli/src/new/versions.ts` (o teste `versions.test.ts` falha até ele acompanhar) e confira as faixas de `packages/cli/src/doctor/ranges.ts`.
2. Um pull request leva a `develop` para a `main`.
3. O workflow de publicação publica no npm as versões que faltam, autenticado pelo Trusted Publishing.

Não rode `changeset publish` nem `pnpm publish` à mão.

## Relatar um problema

Abra uma issue com:

- o que você fez (o comando, com as opções) e o que esperava;
- o que aconteceu, com a saída completa;
- a saída do `pnpm exec prumo doctor`;
- o sistema operacional.

Para uma vulnerabilidade, **não** abra uma issue pública: siga o [SECURITY.md](SECURITY.md).
