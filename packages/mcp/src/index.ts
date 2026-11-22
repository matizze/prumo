/**
 * Ponto de entrada do @matizze/prumo-mcp: o servidor MCP do Prumo, uma ferramenta por comando da
 * CLI. O bin `prumo-mcp` (`bin.ts`) liga o servidor ao stdio; aqui estão as peças, para os testes.
 */
export { PACKAGE_NAME, PACKAGE_VERSION } from './package-info.ts'
export { inputSchemaOf } from './schema.ts'
export { createServer, type PrumoServer, type ServerOptions } from './server.ts'
export { toolsOf, type PrumoTool, type ToolsOptions } from './tools.ts'
