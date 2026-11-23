const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Lê uma data como a pessoa a escreveu. Texto `AAAA-MM-DD` (sem hora) vira meia-noite no **fuso
 * local**, e não em UTC: assim `'2026-11-22'` continua sendo dia 22 no Brasil, em vez de virar
 * 21 às 21h. `Date`, número e texto com hora (ISO completo) seguem o comportamento do `Date`.
 * Uma data que não existe (`'2026-02-31'`) vira `Invalid Date`.
 */
export function parseLocalDate(value: Date | number | string): Date {
  if (typeof value !== 'string') return value instanceof Date ? value : new Date(value)
  const match = DATE_ONLY.exec(value)
  if (!match) return new Date(value)
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  // `new Date(2026, 1, 31)` rola para março: confere que o dia escrito é o dia obtido.
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return valid ? date : new Date(Number.NaN)
}

/** Lê os dez primeiros caracteres (`AAAA-MM-DD`) como meia-noite UTC, sem depender do fuso. */
function utcMidnight(isoDate: string) {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`)
}

/** Soma `days` dias a uma data ISO (AAAA-MM-DD) e devolve AAAA-MM-DD, em UTC. */
export function addDays(isoDate: string, days: number) {
  const date = utcMidnight(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Quantos dias há de `from` até `to` (datas `AAAA-MM-DD`, ou ISO com hora, de que só a data
 * conta). Positivo quando `to` é depois de `from`; o horário de verão não interfere.
 */
export function daysBetween(from: string, to: string) {
  return Math.round((utcMidnight(to).getTime() - utcMidnight(from).getTime()) / 86_400_000)
}
