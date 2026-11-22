/**
 * Ponto de entrada do @matizze/prumo-cli.
 *
 * O conteúdo do pacote é o comando `prumo`, o bin em `src/bin.ts`, montado pelo `src/root.ts`, que
 * lista os comandos. A API em processo (rodar um comando e descrever a árvore) está em `src/api.ts`,
 * reexportada aqui e publicada também como `@matizze/prumo-cli/api`.
 */
export const PACKAGE_NAME = '@matizze/prumo-cli'

export * from './api.ts'
