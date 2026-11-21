import { defineCommand } from 'citty'
import { check } from '@matizze/prumo-rules/check'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { generateDomain, REFERENCE_DOMAIN } from '../codemod/index.ts'
import { ExitError } from '../errors.ts'
import { findProject } from '../project.ts'
import type { Runtime } from '../runtime.ts'
import { formatViolation } from './check.ts'
import { formatSummary, testCommandFor } from './shared.ts'

/**
 * `prumo make:domain <nome> [--entity <singular>]`: gera um domínio de dados a partir do domínio
 * de referência do próprio projeto (`customers`): o schema da entidade, o repositório (contrato,
 * mock com latência, fixtures e teste de contrato) e as queries, renomeados pela estrutura do
 * código, e faz as costuras nos três índices (`schemas`, `repositories` e `queries`). Valida tudo
 * antes de escrever, então um erro de uso (saída 2) não deixa o projeto pela metade, e `--dry-run`
 * só lista o que seria feito. Ao terminar, roda a análise do `prumo check` e mostra o comando dos
 * testes do domínio novo; o `check` com violação sai com 1, já com o domínio gerado.
 */
export function createMakeDomainCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'make:domain',
      description: `Gera um domínio de dados novo a partir do domínio ${REFERENCE_DOMAIN} do projeto.

Copia o schema (src/schemas/entities/<entidade>.ts), o repositório (src/repositories/<nome>/, com
contrato, mock com latência, fixtures e teste de contrato) e as queries (src/queries/<nome>.ts) do
domínio ${REFERENCE_DOMAIN}, renomeia pela estrutura do código (Customer, ICustomersRepository,
MockCustomersRepository, createCustomersRepository, MOCK_CUSTOMERS, customerKeys, customerQueries,
a chave do container e do createQueryKeys, o código de erro e o prefixo dos ids das fixtures) e faz
as costuras: o export em src/schemas/index.ts; o import, o export * e a entrada do mapa factories
em src/repositories/index.ts (em ordem alfabética); e o export em src/queries/index.ts. O tipo do
container acompanha o mapa sozinho.

O nome é o do domínio, no plural e em kebab-case (suppliers, purchase-orders). A entidade é o
singular, que sai do nome (tira o s final). Onde a regra erra (o plural termina em ies, us, ss, xes,
ches, shes ou sses), o comando recusa e pede a entidade com --entity: categories daria categorie, e
o certo é --entity category.

Os campos, as fixtures e a mensagem de erro são os de ${REFERENCE_DOMAIN}, e o produto edita o
schema depois: o teste de contrato gerado passa porque as fixtures vêm junto.

Valida tudo antes de escrever. Ao terminar, roda o prumo check e mostra o comando dos testes do
domínio novo. Sai com código 1 se o check achar violação (o domínio já foi gerado) e com 2 se o uso
está errado: nome inválido ou reservado, singular suspeito, domínio que já existe, nome exportado
que um índice já exporta (TS2308), referência incompleta, índice que falta.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'Nome do domínio, no plural e em kebab-case (por exemplo, suppliers).',
      },
      entity: {
        type: 'string',
        valueHint: 'singular',
        description:
          'A entidade, no singular (por exemplo, supplier). Padrão: o nome sem o s final.',
      },
      root: {
        type: 'string',
        valueHint: 'pasta',
        description: 'Pasta do projeto, a que tem o src. Padrão: a pasta atual.',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Só lista o que seria criado e alterado, sem escrever nada.',
      },
    },
    run({ args }) {
      const project = findProject(path.resolve(runtime.cwd, args.root ?? '.'))
      const dryRun = Boolean(args['dry-run'])
      const { plan, from, to } = generateDomain(project, { name: args.nome, entity: args.entity })

      const heading = `prumo make:domain: ${to.plural.kebab} (entidade ${to.singular.kebab}), a partir de ${from.plural.kebab}.`
      if (dryRun) {
        runtime.out(
          `${heading}\n\n${formatSummary(plan.summary(), true)}\nSimulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }

      const summary = plan.commit()
      runtime.out(`${heading}\n\n${formatSummary(summary, false)}\n`)

      const violations = check({ root: project.root })
      const schema = `src/schemas/entities/${to.singular.kebab}.ts`
      const fixtures = `src/repositories/${to.plural.kebab}/fixtures.ts`
      const keysTest = existsSync(path.join(project.src, 'queries', 'keys.test.ts'))
        ? `As chaves (${to.singular.camel}Keys) não entram sozinhas no snapshot de src/queries/keys.test.ts: acrescente-as à lista de grupos protegidos dele, se quiser congelá-las.\n`
        : ''
      const next = `Os campos, as fixtures e a mensagem de erro são os de ${from.plural.kebab}: edite ${schema} e ${fixtures}.\n${keysTest}\nPara rodar os testes do domínio novo:\n  ${testCommandFor(project, runtime.cwd, `src/repositories/${to.plural.kebab}`)}\n`
      if (violations.length === 0) {
        runtime.out(`prumo check: nenhuma violação.\n\n${next}`)
        return
      }
      const total = violations.length === 1 ? '1 violação' : `${violations.length} violações`
      runtime.err(
        `prumo check: ${total} (o domínio foi gerado, e os arquivos ficaram no projeto):\n${violations.map(formatViolation).join('\n')}\n`,
      )
      runtime.out(`\n${next}`)
      throw new ExitError(1)
    },
  })
}
