# @matizze/prumo-mcp

## 0.2.0

### Minor Changes

- eccafa4: `make:domain --fields` gera o domínio com os campos da entidade, em vez de só `name`:
  
  ```sh
  pnpm exec prumo make:domain livros --fields "titulo:string,autor:string,ano:number,disponivel:boolean,publicadoEm:date,apelido?:string"
  ```
  
  - Sintaxe `nome:tipo` separados por vírgula: nome em camelCase; tipos `string`, `number`, `boolean`, `date` (`AAAA-MM-DD`) e `datetime` (ISO); `?` depois do nome torna o campo opcional. `id` e `createdAt` (reservados), nomes repetidos, tipos desconhecidos e listas mal formadas são recusados (código 2), sem escrever nada.
  - O schema, o schema de entrada, as fixtures (três registros), o mock (busca nos campos de texto, ordem pelos campos, `create` e `update` com todos os campos) e o teste de contrato saem coerentes com os campos. Datas viram `z.iso.date()` e `z.iso.datetime()`.
  - `make:page --domain` (lista e detalhe) mostra o primeiro campo de texto obrigatório do schema que existe no projeto (o app pode tê-lo editado depois), no lugar de `name`, e o teste da tela de detalhe espera o valor desse campo na primeira fixture. Sem campo de texto, ou sem achar o schema, a tela mostra o `id` e o comando avisa na saída. Num domínio sem `--fields` (só `name`), o resultado é o de antes.
  - Sem `--fields`, o `make:domain` gera exatamente o que gerava. O servidor MCP ganha o campo `fields` na ferramenta `make_domain`.
- ef60741: `make:page` ganha `--path <caminho>` (e a ferramenta `make_page` do MCP, o campo `path`): a rota da tela deixa de ser sempre `/<nome>`. O caminho é validado (começa com `/`, segmentos válidos, no máximo um parâmetro `:nome`, sem `?`, `*` nem `+`) e recusado se repete ou conflita com uma rota do `App.tsx`. Com parâmetro (`--path /livros/:id`), o model gerado lê o valor com o `useParams` do wouter, a view o mostra e o teste renderiza a tela dentro de `<Route path="...">` com um valor de exemplo, então um descompasso entre a rota e a tela passa a falhar. Junto de `--domain`, a tela é de detalhe: o model busca o registro com o `use<Entidade>Detail` do domínio. Sem `--path`, nada muda.
- d8312c8: Promover um componente de tela a compartilhado agora é um comando:
  
  - `prumo move:component <nome> --from <tela> --shared` (ferramenta MCP `move_component`) move o componente e o teste dele de `src/pages/<tela>/components/` para `src/components/shared/` e reescreve para `@/components/shared/<nome>` todo import que apontava para ele (na tela de origem e em qualquer outro arquivo de `src`, inclusive `vi.mock` e `import()`). Aceita `--dry-run`. Recusa, sem mexer em nada, o nome inválido, a tela ou o componente que não existe, o homônimo já em `shared` e o componente que importa algo de uma tela. No fim roda o `prumo check`: a `shared-usage` do componente movido, ainda de uma tela só, é mostrada como esperada e não faz o comando falhar. O caminho inverso (de `shared` para uma tela) não existe.
  - `make:component` avisa (`Aviso: ...`, sem recusar) quando já existe um componente de mesmo nome em outra tela ou em `shared`, e sugere o `move:component`. O mesmo nome no mesmo lugar continua recusado.
  - O `AGENTS.md` do app novo lista o comando novo, e `docs/reference/cli.md`, `docs/reference/mcp.md` e o guia de telas descrevem o caminho "o componente passou a ser usado por duas telas".

### Patch Changes

- 0eb8d2b: O README de cada pacote, que é a página dele no npm, foi reescrito: instalação, uso essencial e links para a documentação completa do Prumo (tutorial, guias e referência). A descrição do `@matizze/prumo-cli` no npm passa a citar todos os comandos.
- Updated dependencies [7565ccd]
- Updated dependencies [857c809]
- Updated dependencies [375644a]
- Updated dependencies [0eb8d2b]
- Updated dependencies [eccafa4]
- Updated dependencies [ef60741]
- Updated dependencies [d8312c8]
- Updated dependencies [1b79171]
  - @matizze/prumo-cli@0.6.0

## 0.1.3

### Patch Changes

- O README publicado no npm deixa de dizer que o pacote não foi publicado e ganha a seção Instalação.
- Updated dependencies
  - @matizze/prumo-cli@0.5.2

## 0.1.2

### Patch Changes

- Updated dependencies [bf849f4]
  - @matizze/prumo-cli@0.5.1

## 0.1.1

### Patch Changes

- 3e763de: Publicado no npm público (`registry.npmjs.org`, acesso público), sem token para instalar.
- Updated dependencies [3e763de]
  - @matizze/prumo-cli@0.5.0

## 0.1.0

### Minor Changes

- Primeira versão. O servidor MCP do Prumo (`prumo-mcp`, por stdio) expõe uma ferramenta por comando da CLI: `new`, `make_page`, `make_domain`, `make_component`, `check` e `doctor`. O nome, a descrição e o esquema de cada ferramenta saem da árvore de comandos da CLI; os campos `root` e `dir` ficam dentro da pasta onde o servidor roda, as chamadas rodam em fila e o stdout é só o protocolo.

### Patch Changes

- Updated dependencies
  - @matizze/prumo-cli@0.4.0
