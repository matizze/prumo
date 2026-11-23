import { defineCommand } from 'citty'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { generateDomain } from '../generate/domain.ts'
import { describeField } from '../generate/fields.ts'
import { findProject } from '../project.ts'
import type { Runtime } from '../runtime.ts'
import { checkBefore, finishWithCheck, formatSummary, testCommandFor } from './shared.ts'

/**
 * `prumo make:domain <nome> [--entity <singular>]`: gera um domínio de dados a partir dos modelos
 * do pacote (nunca copiando outro domínio do projeto): o schema da entidade, o repositório
 * (contrato, mock com fixtures e latência, index e teste de contrato) e as queries com os hooks, e
 * registra o domínio nos três índices e no container. Valida tudo antes de escrever, então um erro
 * de uso (saída 2) não deixa o projeto pela metade, e `--dry-run` só lista o que seria feito. Ao
 * terminar, roda o `prumo check`; com violação sai com 1, já com o domínio gerado.
 */
export function createMakeDomainCommand(runtime: Runtime) {
  return defineCommand({
    meta: {
      name: 'make:domain',
      description: `Gera um domínio de dados novo: schema, repositório com mock, queries e teste de contrato.

Cria o schema da entidade (src/schemas/entities/<entidade>.ts, com zod: id, os campos e createdAt), o
repositório (src/repositories/<nome>/: contrato, mock com fixtures e a latência simulada do core,
index e o teste de contrato do @matizze/prumo-testing) e as queries (src/queries/<nome>.ts: query
keys do core, as queries e os hooks de lista, detalhe e mutations do TanStack Query). Acrescenta o texto de <ENTIDADE>_NOT_FOUND (o código que o mock lança) ao errors.json de cada
idioma; num app sem esse arquivo, avisa e segue. Registra o
domínio em src/schemas/index.ts, src/repositories/index.ts (o import, o export * e a entrada no
mapa factories, que é o container, em ordem alfabética) e src/queries/index.ts. O tipo do container
acompanha o mapa sozinho.

O nome é o do domínio, no plural e em kebab-case (clientes, pedidos-recentes). A entidade é o
singular, que sai do nome (tira o s final). Onde a regra erra (o plural termina em ies, us, ss, xes,
ches, shes ou sses), o comando recusa e pede a entidade com --entity: categories daria categorie, e
o certo é --entity category.

Os campos da entidade vêm de --fields, no formato nome:tipo separados por vírgula
("titulo:string,ano:number,disponivel:boolean,publicadoEm:date"): nome em camelCase e tipo string,
number, boolean, date (AAAA-MM-DD) ou datetime (ISO com hora); um ? depois do nome torna o campo
opcional ("apelido?:string"). Os nomes id e createdAt são reservados, e um nome repetido é recusado.
Com os campos, o schema, o schema de entrada, as fixtures (três registros), o mock (busca nos campos
de texto, ordem pelos campos, create e update) e o teste de contrato saem coerentes com eles; make:page
--domain mostra o primeiro campo de texto. Sem --fields, o domínio tem só o campo name, de texto.

Os hooks pegam o repositório de useRepositories(), de src/providers/repository, e o teste de
contrato é o que o mock cumpre: edite o schema e as fixtures depois, e o contrato junto.

Valida tudo antes de escrever e recusa sobrescrever. Ao terminar, roda o prumo check e mostra o
comando dos testes do domínio novo. Sai com código 1 se o check achar violação nova, causada por ele (o domínio já foi
gerado; a violação que já existia antes aparece como preexistente e não conta) e com 2 se o uso está errado: nome inválido ou reservado, singular suspeito, domínio que
já existe, índice que falta.`,
    },
    args: {
      nome: {
        type: 'positional',
        required: true,
        description: 'Nome do domínio, no plural e em kebab-case (por exemplo, clientes).',
      },
      entity: {
        type: 'string',
        valueHint: 'singular',
        description:
          'A entidade, no singular (por exemplo, cliente). Padrão: o nome sem o s final.',
      },
      fields: {
        type: 'string',
        valueHint: 'campos',
        description:
          'Os campos da entidade, nome:tipo separados por vírgula (por exemplo, "titulo:string,ano:number,apelido?:string"). Tipos: string, number, boolean, date, datetime; ? torna opcional. Padrão: só name:string.',
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
      const { plan, names, fields, warnings } = generateDomain(project, {
        name: args.nome,
        entity: args.entity,
        fields: args.fields,
      })
      const warningsText = warnings.map((warning) => `Aviso: ${warning}\n`).join('') + (warnings.length > 0 ? '\n' : '')
      const fieldsText = args.fields === undefined ? '' : `\nCampos: ${fields.map(describeField).join(', ')}.`
      const heading = `prumo make:domain: ${names.plural.kebab} (entidade ${names.singular.kebab}).${fieldsText}`

      if (args['dry-run']) {
        runtime.out(
          `${heading}\n\n${formatSummary(plan.summary(), true)}\n${warningsText}Simulação (--dry-run): nada foi escrito.\n`,
        )
        return
      }

      const before = checkBefore(project)
      const summary = plan.commit()
      runtime.out(`${heading}\n\n${formatSummary(summary, false)}\n${warningsText}`)

      const schema = `src/schemas/entities/${names.singular.kebab}.ts`
      const fixtures = `src/repositories/${names.plural.kebab}/fixtures.ts`
      const hasProvider = ['index.ts', 'index.tsx'].some((file) =>
        existsSync(path.join(project.src, 'providers', 'repository', file)),
      )
      const provider = hasProvider
        ? ''
        : `As queries importam useRepositories de @/providers/repository, e o projeto não tem src/providers/repository: crie-o com createRepositoryContext, de @matizze/prumo-core/repositories.\n`
      const edit =
        args.fields === undefined
          ? `Edite o schema (${schema}) e as fixtures (${fixtures}); o teste de contrato acompanha.`
          : `Os campos vieram de --fields. Para mudar a forma do dado depois, edite o schema (${schema}), as fixtures (${fixtures}), o mock e o teste de contrato (guia docs/guides/domains.md).`
      const next = `${edit}\n${provider}\nPara rodar os testes do domínio novo:\n  ${testCommandFor(project, runtime.cwd, `src/repositories/${names.plural.kebab}`)}\n`

      finishWithCheck(runtime, project, { generated: 'o domínio foi gerado', next, before })
    },
  })
}
