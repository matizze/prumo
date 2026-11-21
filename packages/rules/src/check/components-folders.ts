import path from 'node:path'
import { listDirs } from './files.ts'
import type { ResolvedOptions, Violation } from './types.ts'

/**
 * A pasta dos componentes só tem as subpastas permitidas (por padrão `ui`, `shared` e
 * `layout`). Uma subpasta de fora acusa, porque componente que não é do design system, de uso
 * comum nem da casca do layout mora na tela que o usa. Subpasta que falta não acusa: um
 * projeto pode não ter layout.
 */
export function checkComponentsFolders(options: ResolvedOptions): Violation[] {
  const allowed = options.allowedComponentDirs
  return listDirs(path.join(options.root, options.componentsDir))
    .filter((dir) => !allowed.includes(dir))
    .map((dir): Violation => ({
      rule: 'components-folders',
      file: `${options.componentsDir}/${dir}`,
      message: `A pasta '${dir}' não é permitida em ${options.componentsDir}: só ${allowed.map((d) => `'${d}'`).join(', ')}.`,
    }))
}
