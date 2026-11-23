/**
 * Os pacotes do Prumo que um app novo instala, na ordem em que o `pnpm pack:all` os empacota, e a
 * versão de cada um. O `prumo new` grava `^<versão>` no `package.json` do app. A lista é conferida
 * por um teste contra os `package.json` de `packages/*`: ao subir a versão de um pacote (o
 * `pnpm changeset version`), o teste falha até este arquivo acompanhar.
 */
export const PRUMO_VERSIONS: Readonly<Record<string, string>> = {
  '@matizze/prumo-rules': '0.2.3',
  '@matizze/prumo-core': '0.2.0',
  '@matizze/prumo-testing': '0.3.0',
  '@matizze/prumo-cli': '0.6.0',
  '@matizze/prumo-mcp': '0.2.0',
}
