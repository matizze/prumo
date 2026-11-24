---
'@matizze/prumo-cli': minor
---

A CLI foi reescrita do zero com o commander. A arquitetura do app gerado é a mesma; mudam os comandos, as opções e as mensagens, agora todas em português, com os códigos de saída `0` (sem erro), `1` (erro inesperado, ou violação no `check`) e `2` (uso errado: comando, opção ou argumento que não existe, nome inválido, camada que falta). Todo comando que escreve valida tudo antes e nunca sobrescreve arquivo; `new` e os `make:*` aceitam `--dry-run`, e os `make:*` e o `check` aceitam `--root <pasta>` (o `new` tem `--dir`).

**Os comandos da v1**

- `prumo new <nome>`: cria o app (Vite, React 19, TypeScript, wouter, TanStack Query, zod e i18next, os pacotes do Prumo, a estrutura em camadas e a tela `home`). Opções `--dir`, `--no-install` e `--packages`. O app sai sem `.mcp.json` e sem `@matizze/prumo-mcp`, com a fonte de dados `mock`, o `src/vite-env.d.ts` e o `AGENTS.md` e o `README.md` descrevendo os comandos da v1.
- `prumo make:schema <domínio>`: cria o schema zod de uma entidade e o registra. `--entity <singular>` dá o singular quando o automático erra (`paes` com `--entity pao`); `--fields` define os campos (`titulo:string,ano:int,situacao:enum(lido|lendo),apelido?:string`), com os tipos `string`, `number`, `int`, `boolean`, `date`, `datetime` e `enum(a|b|c)` e o `?` para campo opcional.
- `prumo make:repository <domínio>`: cria o contrato, o repositório `mock`, as fixtures, o teste de contrato e a fábrica, e registra o domínio no container e o texto de `<ENTIDADE>_NOT_FOUND` nos `errors.json`. Precisa do schema e lê os campos dele (busca, ordem, fixtures e teste de contrato), sem `--fields`; um campo que o comando não reconhece, num schema editado à mão, é erro de uso, com a linha. `--entity` como no `make:schema`.
- `prumo make:query <domínio>`: cria `src/queries/<domínio>.ts` (chaves, `use<Domínio>List`, `use<Entidade>Detail`, `useCreate<Entidade>`, `useUpdate<Entidade>` e `useRemove<Entidade>`) e o registra. Precisa do repositório.
- `prumo make:page <nome>`: cria a tela (`index`, `model`, `view` e o teste), os textos em cada idioma e a rota. `--query <domínio>` gera a lista (ou, com parâmetro no caminho, o detalhe) usando a query; `--path <caminho>` define a rota, com um parâmetro opcional (`/clientes/:id`).
- `prumo check`: confere a arquitetura do projeto, uma violação por linha, e sai com 1 se houver.

Cada camada usa a de baixo, então a ordem é `make:schema`, `make:repository`, `make:query` e `make:page --query`. Se uma camada falta, o comando sai com 2, sem criar nada, e diz o que rodar.

**Fontes de dados**

`make:repository --data-source <mock|http|storage>` (padrão `mock`) acrescenta uma fonte ao mesmo contrato, e cria o repositório inteiro se ele ainda não existe. O `storage` é o mock gravando no `localStorage` (chave `<nome do app>:<domínio>`). O `http` usa `fetch` por um cliente em `src/repositories/http.ts`: o backend responde no formato do app (`{ items, total }`), o repositório só valida a resposta com o schema, envia `search`, `sort=<campo>:<asc|desc>`, `page` e `page_size`, usa `PATCH` no `update` e transforma o 404 em `<ENTIDADE>_NOT_FOUND`. O app escolhe a fonte por `VITE_DATA_SOURCE` (`mock` quando falta), e o teste de contrato do `http` só roda com `API_TEST_URL`.

**O que saiu**

- `make:domain` saiu, e o substituto são os três comandos: `make:schema`, `make:repository` e `make:query`.
- `make:page --domain` virou `make:page --query`.
- A fonte de dados `memory` virou `mock`.
- Saíram sem substituto: o servidor MCP e o pacote `@matizze/prumo-mcp`, o `doctor`, o `make:component` e o `move:component` (os componentes de interface vêm do design system do produto, e os do produto se criam à mão), e a API em processo (`@matizze/prumo-cli/api`).
