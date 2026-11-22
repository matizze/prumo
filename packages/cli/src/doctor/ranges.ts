/**
 * As faixas de versão dos pacotes do Prumo que esta CLI espera num projeto, para o `prumo doctor`.
 *
 * Os pacotes versionam separados (o cli está na 0.5.1, o core na 0.1.3), então a comparação é por
 * faixa compatível, não por igualdade: `>=mínimo <limite`. O Changesets não mantém um campo
 * próprio do `package.json` (ele só atualiza `dependencies`, `devDependencies` e
 * `peerDependencies`, e o cli não depende do core nem do testing), então a tabela mora aqui e o
 * `ranges.test.ts` a compara com o `package.json` de cada pacote do workspace: quando um pacote
 * sai da faixa (uma versão que quebra a compatibilidade), o teste falha e a faixa é revista junto.
 *
 * A faixa do próprio `@matizze/prumo-cli` não está na tabela: é a da versão que está rodando.
 */
export const PRUMO_PACKAGE_RANGES: Readonly<Record<string, string>> = {
  '@matizze/prumo-core': '>=0.1.0 <0.2.0',
  '@matizze/prumo-rules': '>=0.2.0 <0.3.0',
  '@matizze/prumo-testing': '>=0.2.0 <0.3.0',
  '@matizze/prumo-mcp': '>=0.1.0 <0.2.0',
}

export const CLI_PACKAGE_NAME = '@matizze/prumo-cli'

/** Os pacotes do Prumo que o `doctor` confere, na ordem em que aparecem. */
export const PRUMO_PACKAGES: readonly string[] = [
  '@matizze/prumo-core',
  '@matizze/prumo-rules',
  '@matizze/prumo-testing',
  '@matizze/prumo-mcp',
  CLI_PACKAGE_NAME,
]
