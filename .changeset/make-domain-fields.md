---
'@matizze/prumo-cli': minor
'@matizze/prumo-mcp': minor
---

`make:domain --fields` gera o domínio com os campos da entidade, em vez de só `name`:

```sh
pnpm exec prumo make:domain livros --fields "titulo:string,autor:string,ano:number,disponivel:boolean,publicadoEm:date,apelido?:string"
```

- Sintaxe `nome:tipo` separados por vírgula: nome em camelCase; tipos `string`, `number`, `boolean`, `date` (`AAAA-MM-DD`) e `datetime` (ISO); `?` depois do nome torna o campo opcional. `id` e `createdAt` (reservados), nomes repetidos, tipos desconhecidos e listas mal formadas são recusados (código 2), sem escrever nada.
- O schema, o schema de entrada, as fixtures (três registros), o mock (busca nos campos de texto, ordem pelos campos, `create` e `update` com todos os campos) e o teste de contrato saem coerentes com os campos. Datas viram `z.iso.date()` e `z.iso.datetime()`.
- `make:page --domain` (lista e detalhe) mostra o primeiro campo de texto obrigatório do schema que existe no projeto (o app pode tê-lo editado depois), no lugar de `name`, e o teste da tela de detalhe espera o valor desse campo na primeira fixture. Sem campo de texto, ou sem achar o schema, a tela mostra o `id` e o comando avisa na saída. Num domínio sem `--fields` (só `name`), o resultado é o de antes.
- Sem `--fields`, o `make:domain` gera exatamente o que gerava. O servidor MCP ganha o campo `fields` na ferramenta `make_domain`.
