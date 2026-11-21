# @matizze/prumo-cli

## 0.1.0

### Minor Changes

- 6419a6d: Novo bin `prumo` com o comando `prumo check [--root <pasta>]`, que roda a análise de `@matizze/prumo-rules/check` no projeto (a pasta atual, por padrão) e escreve uma linha por violação, com o arquivo, a regra e o que está errado. O código de saída é 0 sem violação, 1 com violação e 2 se o uso está errado, então serve de portão na CI. O pacote passa a depender de `@matizze/prumo-rules`.

### Patch Changes

- be0fd64: `prumo check` com `--root` que não existe, que não é pasta ou que não tem `src` agora escreve um erro claro em português e sai com código 2, em vez de sair verde sem analisar nada.
- Updated dependencies [be0fd64]
- Updated dependencies [52543cb]
- Updated dependencies [7d40cb1]
- Updated dependencies [e90f277]
- Updated dependencies [e52f705]
- Updated dependencies [e90f277]
- Updated dependencies [8f37583]
- Updated dependencies [3ba9751]
  - @matizze/prumo-rules@0.1.0
