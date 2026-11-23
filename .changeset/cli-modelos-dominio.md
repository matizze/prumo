---
'@matizze/prumo-cli': minor
---

Modelos de domínio corrigidos, vindos de um app real. Vale para os domínios gerados daqui em diante; um domínio já gerado não muda sozinho (o contrato dele continua o mesmo e nada quebra):

- `use<Domínio>List(query, options)` aceita as opções do `useQuery` (`enabled`, `staleTime`, `select`...) e mantém por padrão os dados da consulta anterior enquanto a nova carrega (`placeholderData: keepPreviousData`): ao buscar, filtrar ou paginar, a tela não volta para "Carregando…". Num domínio antigo, acrescente o segundo parâmetro e o `placeholderData` ao hook.
- `useRemove<Entidade>` tira do cache o detalhe do registro removido e invalida só as listas (nova chave `<entidade>Keys.lists`), em vez de buscar o detalhe de novo e notificar "não encontrado". Num domínio antigo, troque o `onSuccess` do remove por `removeQueries({ queryKey: keys.detail(id) })` e `invalidateQueries({ queryKey: keys.lists })` (com `lists: ['list']` nas keys).
- `update` do contrato, do mock e do hook passa a aceitar entrada parcial (`Partial<Input>`): só os campos enviados mudam, e o teste de contrato ganha o caso. Para mudar um ou dois campos não é mais preciso reenviar o registro. Num domínio antigo, troque o tipo do `input` por `Partial<...Input>` no contrato, no mock (`{ ...item, ...input }`) e no hook; a implementação HTTP passa a usar `PATCH`.
- A tela de detalhe gerada com `--domain` já fica certa com isso (ela só lê o registro).
- Documentação: o guia de domínios ganha as seções "Onde o `name` aparece", "Filtros na consulta da lista" e "Consultas que dependem de hoje", e a "Mudar a forma do dado" lista todos os pontos que citam o `name`.
