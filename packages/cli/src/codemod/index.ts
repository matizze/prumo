export { addRoute, openOriginApp, type RouteSpec } from './add-route.ts'
export { applyEdits, spliceText, type TextEdit } from './edit.ts'
export { mergeBarrel } from './merge-barrel.ts'
export { messageKeys } from './messages.ts'
export {
  assertNotReserved,
  assertValidName,
  deriveNames,
  domainNames,
  GLOBAL_NAMES,
  isValidName,
  RESERVED_WORDS,
  singularOf,
  usableNames,
  type DomainNames,
  type Names,
} from './names.ts'
export { ChangePlan, type PlanSummary } from './plan.ts'
export {
  isQueriesRegistered,
  isRepositoryRegistered,
  registerDomain,
  registerQueries,
  registerQueriesEntry,
  registerRepository,
  registerRepositoryEntry,
  registerSchema,
  type QueriesEntry,
  type RepositoryEntry,
} from './register-domain.ts'
export { registerMessageNamespace } from './register-messages.ts'
