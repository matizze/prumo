# Primeiros passos

Neste tutorial você cria um app com o Prumo, gera as camadas de um domínio de dados (schema, repositório e queries) e uma tela que o lista, muda os textos, cria um componente à mão e vê a verificação da arquitetura em ação. No fim, você terá passado por todas as camadas que o Prumo organiza.

Tempo estimado: 15 minutos.

## Antes de começar

Você precisa do **Node.js 24** ou mais novo e do **pnpm 10** ou mais novo:

```bash
node --version   # v24.x ou mais novo
pnpm --version   # 10.x ou mais novo
```

Se o pnpm não estiver instalado: `npm install -g pnpm` (no Node 24, também dá para usar o Corepack, que vem com ele: `corepack enable`).

Os pacotes do Prumo estão no npm público. Não há token, `.npmrc` nem configuração a fazer.

## 1. Crie o app

```bash
pnpm dlx @matizze/prumo-cli new loja
```

O comando cria a pasta `loja`, roda `git init` (sem commit: o primeiro commit é seu) e `pnpm install`. A saída lista os arquivos criados, mostra o andamento do `pnpm install` e termina com os próximos passos:

```text
prumo new: loja.
Destino: /home/voce/loja

Criados (31):
  .gitignore
  AGENTS.md
  README.md
  eslint.config.js
  ...
  src/pages/home/index.tsx
  src/pages/home/model.ts
  src/pages/home/view.tsx
  ...

Pacotes do Prumo: do registry, pela versão (^<versão>) no package.json.

Instalando as dependências (pnpm install)...
...

Próximos passos:
  cd loja
  pnpm verify                                   # typecheck, lint, test e check
  pnpm dev                                      # o app em http://localhost:5173
  pnpm exec prumo make:page <tela>              # uma tela, com a rota e as mensagens

A documentação (tutorial, conceitos e guias): https://docs.prumo.matizze.com.br
```

> Para ver o que seria criado sem escrever nada, use `--dry-run`. Para escolher outra pasta, `--dir <pasta>`. Todas as opções estão na [referência da CLI](reference/cli.md).

Entre na pasta e suba o app:

```bash
cd loja
pnpm dev
```

Em `http://localhost:5173` aparece a tela inicial, com o título "Home". Ela não tem estilo nenhum, e é de propósito: o Prumo não traz CSS nem design system. A interface é do seu produto (veja o guia [Design system](guides/design-system.md)).

## 2. Conheça o que foi criado

```text
loja/
  src/
    App.tsx              as rotas (wouter)
    main.tsx             monta o app com os provedores
    i18n.ts              o i18n tipado pelas mensagens
    pages/home/          a tela inicial: index, model, view e o teste
    messages/pt-BR/      os textos em português (um JSON por tela)
    messages/en/         os textos em inglês
    providers/           TanStack Query, i18n e repositórios
    repositories/        o container de repositórios e as fontes de dados (vazio por enquanto)
    schemas/  queries/   os índices dos domínios (vazios por enquanto)
    test/                o renderWithProviders e o setup do Vitest
  AGENTS.md              o guia do projeto para agentes de IA
  eslint.config.js       com o plugin de arquitetura do Prumo
```

Abra a tela inicial. Ela tem três arquivos, e cada um tem um papel:

```tsx
// src/pages/home/index.tsx: liga o model à view
export default function HomePage() {
  const model = useHomeModel()
  return <HomeView {...model} />
}
```

```ts
// src/pages/home/model.ts: dados e textos, sem JSX
export function useHomeModel() {
  const t = useTranslations('home')
  return { title: t('title') }
}

export type HomeModel = ReturnType<typeof useHomeModel>
```

```tsx
// src/pages/home/view.tsx: apresentação, recebe tudo por props
export function HomeView(m: HomeModel) {
  return (
    <main>
      <h1>{m.title}</h1>
    </main>
  )
}
```

Essa separação é o centro da arquitetura: a view pode ser trocada inteira (por outra biblioteca visual, por exemplo) sem tocar nos dados, e o model pode ser testado sem se preocupar com o visual. O detalhe de cada arquivo está em [Anatomia do app gerado](concepts/generated-app.md).

## 3. Rode a verificação

```bash
pnpm verify
```

O `verify` roda, em sequência, o `tsc`, o ESLint (com as regras do Prumo), os testes do Vitest e, por último, o `prumo check` (a análise da arquitetura do projeto inteiro). Os testes vêm antes do `check` para que uma violação dele não os esconda, mas o `verify` continua falhando se o `check` falhar. Nada disso precisa de navegador. Use-o antes de dar qualquer tarefa por pronta.

## 4. Gere um domínio de dados

Um domínio é um conjunto de dados do produto: clientes, pedidos, produtos. Cada camada dele tem o seu comando, e a ordem vai de baixo para cima: o schema, o repositório e as queries. Comece pelo schema de clientes, com os campos do produto:

```bash
pnpm exec prumo make:schema clientes --fields "nome:string,email:string,ativo:boolean,plano:enum(basico|pro),telefone?:string"
```

```text
prumo make:schema: clientes (entidade cliente).
Entidade: cliente (derivada de clientes; use --entity para trocar).
Campos: nome (string), email (string), ativo (boolean), plano (enum(basico|pro)), telefone (string, opcional).

Criados (1):
  src/schemas/entities/cliente.ts

Alterados (1):
  src/schemas/index.ts

Próximo passo: prumo make:repository clientes
```

O nome do domínio vai no plural; a entidade (`cliente`) sai dele, tirando o `s` (quando a regra erra, o `--entity` informa o singular). Os campos são `nome:tipo` separados por vírgula, e o `?` torna o campo opcional (todos os tipos estão em [Domínios](guides/domains.md#os-campos-do-domínio---fields)). Sem `--fields`, a entidade tem só o campo `name`. O schema zod tem o `id`, os campos e o `createdAt`, mais os tipos de entrada e de consulta.

Agora o repositório. Ele lê os campos do schema que acabou de nascer, então não precisa de `--fields`:

```bash
pnpm exec prumo make:repository clientes
```

```text
prumo make:repository: clientes (entidade cliente, fonte mock).
Campos (lidos do schema): nome (string), email (string), ativo (boolean), plano (enum(basico|pro)), telefone (string, opcional).

Criados (5):
  src/repositories/clientes/fixtures.ts
  src/repositories/clientes/index.ts
  src/repositories/clientes/repository.contract.test.ts
  src/repositories/clientes/repository.contract.ts
  src/repositories/clientes/repository.mock.ts

Alterados (3):
  src/messages/en/errors.json
  src/messages/pt-BR/errors.json
  src/repositories/index.ts

Próximo passo: prumo make:query clientes
```

O comando criou:

- o **contrato** do repositório, a interface `IClientesRepository` (`list`, `get`, `create`, `update` e `remove`);
- um **repositório em memória** (`mock`), com latência simulada e três registros de exemplo (as fixtures);
- o **teste de contrato**, que confere que o repositório cumpre a interface;

e registrou o domínio no container de repositórios e o texto de `CLIENTE_NOT_FOUND` nos `errors.json`. Rode os testes dele:

```bash
pnpm test src/repositories/clientes
```

Por fim, as queries:

```bash
pnpm exec prumo make:query clientes
```

```text
prumo make:query: clientes (entidade cliente).
Exporta: clienteKeys, clienteQueries, useClientesList, useClienteDetail, useCreateCliente, useUpdateCliente, useRemoveCliente, type ClientesListOptions.

Criados (1):
  src/queries/clientes.ts

Alterados (1):
  src/queries/index.ts

Próximo passo: prumo make:page clientes --query clientes
```

São os hooks que as telas usam: `useClientesList`, `useClienteDetail`, `useCreateCliente`, `useUpdateCliente` e `useRemoveCliente`.

O repositório em memória permite construir e testar as telas antes de a API existir. Quando ela existir, `prumo make:repository clientes --data-source http` acrescenta outra implementação do mesmo contrato e o resto do app não muda (e `--data-source storage` grava no `localStorage`). O guia [Ligar uma API real](guides/real-api.md) mostra como.

## 5. Gere uma tela que lista o domínio

```bash
pnpm exec prumo make:page clientes --query clientes
```

```text
prumo make:page: clientes (rota /clientes, query clientes).

Criados (6):
  src/messages/en/clientes.json
  src/messages/pt-BR/clientes.json
  src/pages/clientes/index.test.tsx
  src/pages/clientes/index.tsx
  src/pages/clientes/model.ts
  src/pages/clientes/view.tsx

Alterados (3):
  src/App.tsx
  src/messages/en/index.ts
  src/messages/pt-BR/index.ts

Edite o model (src/pages/clientes/model.ts), a view (view.tsx) e os textos (src/messages/<idioma>/clientes.json); o teste acompanha.

Para rodar os testes da tela nova:
  pnpm test src/pages/clientes
```

Com o `pnpm dev` rodando, abra `http://localhost:5173/clientes`: aparece "Carregando…" por um instante (a latência simulada do repositório em memória) e depois a lista com os três exemplos. A view mostra o primeiro campo de texto do schema (aqui, o `nome`); com `--path /clientes/:id` e `--query`, o `make:page` gera a tela de detalhe do registro.

Veja o model que o comando gerou. Ele lê a lista pelo hook do domínio e entrega à view só o que ela precisa:

```ts
// src/pages/clientes/model.ts
export function useClientesModel() {
  const t = useTranslations('clientes')
  const list = useClientesList()
  return {
    title: t('title'),
    loadingText: t('loading'),
    failedText: t('failed'),
    items: list.data?.items ?? [],
    loading: list.isPending,
    failed: list.isError,
  }
}
```

## 6. Mude os textos e veja a verificação agir

Os textos da tela moram em `src/messages/<idioma>/clientes.json`. Acrescente uma mensagem para a lista vazia, **só em português** por enquanto:

```json
// src/messages/pt-BR/clientes.json
{
  "title": "Clientes",
  "loading": "Carregando…",
  "failed": "Não foi possível carregar a lista.",
  "empty": "Nenhum cliente cadastrado."
}
```

Rode a análise da arquitetura:

```bash
pnpm check
```

```text
src/messages/en/clientes.json  [messages]  A chave 'clientes.empty' existe em 'pt-BR' e falta em 'en'.

prumo check: 1 violação.
```

O `prumo check` compara os idiomas e acusa o texto que falta. Acrescente a mesma chave em inglês:

```json
// src/messages/en/clientes.json
{
  "title": "Clientes",
  "loading": "Loading…",
  "failed": "Could not load the list.",
  "empty": "No customers yet."
}
```

> O `make:page` escreve o título em inglês igual ao nome da tela, para você traduzir. Se traduzir o título, atualize também o teste da tela (`index.test.tsx`), que procura o título pelo texto. O guia [Testes](guides/test.md#o-idioma-dos-testes) explica em que idioma os testes rodam.

Agora use o texto. No model, acrescente o texto e um indicador de lista vazia:

```ts
// src/pages/clientes/model.ts (dentro do return)
    emptyText: t('empty'),
    empty: list.isSuccess && list.data.items.length === 0,
```

A chave `'empty'` é tipada: o `useTranslations('clientes')` só aceita chaves que existem nas mensagens em português, e um erro de digitação não compila.

Na view, mostre a mensagem quando a lista estiver vazia:

```tsx
// src/pages/clientes/view.tsx
      {m.loading ? (
        <p>{m.loadingText}</p>
      ) : m.failed ? (
        <p role="alert">{m.failedText}</p>
      ) : m.empty ? (
        <p>{m.emptyText}</p>
      ) : (
        <ul>
          {m.items.map((i) => (
            <li key={i.id}>{i.nome}</li>
          ))}
        </ul>
      )}
```

Repare que a view não sabe de onde os dados vêm nem como os textos são traduzidos: recebe tudo pronto por props.

## 7. Crie um componente da tela

O Prumo não tem comando de componente: os de interface (botão, tabela, diálogo) vêm do design system do produto, por exemplo o shadcn em `src/components/ui`, e os componentes do produto se criam à mão. Componentes usados só por uma tela moram na pasta dela. Crie um resumo para a tela de clientes, em `src/pages/clientes/components/resumo.tsx`:

```tsx
export interface ResumoProps {
  title: string
}

export function Resumo({ title }: ResumoProps) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  )
}
```

Use-o na view: `import { Resumo } from './components/resumo'`.

Um componente que duas ou mais telas usam vai para `src/components/shared`. O `prumo check` confere que ele é mesmo compartilhado: se você mover o resumo para `shared` e só a tela de clientes o usar, ele acusa:

```text
src/components/shared/resumo.tsx  [shared-usage]  O módulo é usado só pela tela 'clientes', e o que está em src/components/shared precisa de 2 ou mais telas: mova-o para a tela que o usa.
```

Também acusa uma pasta nova em `src/components` fora de `ui`, `shared` e `layout`. Deixe o resumo na pasta da tela.

## 8. Veja a arquitetura protegendo o projeto

Tente importar a view da tela inicial dentro da tela de clientes:

```ts
// src/pages/clientes/view.tsx
import { HomeView } from '@/pages/home/view'
```

O editor (com a extensão do ESLint) e o `pnpm lint` acusam na hora:

```text
A tela 'clientes' não importa da pasta da tela 'home' ('@/pages/home/view'): o que as duas usam vai para a pasta de componentes compartilhados.
```

Telas isoladas podem ser mudadas, movidas ou apagadas sem efeito colateral nas outras. Desfaça o import.

As outras regras funcionam do mesmo jeito: uma tela sem `model.ts`, uma pasta nova em `src/components` fora das permitidas, um componente compartilhado que ninguém compartilha. A lista completa está em [Arquitetura](concepts/architecture.md#as-regras).

## 9. Feche com a verificação

```bash
pnpm verify
```

Typecheck, lint, `prumo check` e testes verdes: o app tem um domínio com contrato testado, uma tela com estados de carregamento, erro e lista vazia, textos completos em dois idiomas e um componente.

## Próximos passos

- Ligue uma API no lugar do repositório em memória: [Ligar uma API real](guides/real-api.md).
- Ponha a interface do produto: [Design system](guides/design-system.md).
- Teste os estados da tela: [Testes](guides/test.md).
- Deixe um agente de IA gerar as camadas com os mesmos comandos: [Agentes de IA](guides/ai-agents.md).
- Veja todos os comandos e opções: [Referência da CLI](reference/cli.md).
