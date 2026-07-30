import type { OrderField } from "../../query"
import type { ListQuery } from "../../types"

/** Minimal Orchid reference shape compatible with the nullability metadata used here. */
type OrderFieldRef = {
  toSQL(): string
  result?: {
    value?: {
      data?: {
        isNullable?: boolean
        key?: string
      }
    }
  }
}

type SelectAsItem = {
  selectAs?: Record<string, unknown>
}

function resolveOrderFieldRef(query: ListQuery, field: string): [ref: OrderFieldRef, sourceField: string] {
  const select = query.q.select as unknown[] | undefined
  for (const item of select ?? []) {
    const source = typeof item === "object" && item
      ? (item as SelectAsItem).selectAs?.[field]
      : undefined
    if (source === undefined) {
      continue
    }
    if (typeof source === "string") {
      return [query.ref(source) as unknown as OrderFieldRef, source]
    }

    const ref = query.ref(field) as unknown as OrderFieldRef
    const quotedField = `"${field.replaceAll("\"", "\"\"")}"`
    if (ref.toSQL() !== `${quotedField}.${quotedField}`) {
      throw new Error(
        `Cannot order by selected expression alias "${field}" in cursor pagination because it is not available in WHERE.`,
      )
    }
    return [ref, field]
  }

  return [query.ref(field) as unknown as OrderFieldRef, field]
}

/** Returns true unless Orchid identifies the field as a direct NOT NULL column. */
export function orderFieldNeedsNullRank(query: ListQuery, field: string): boolean {
  const [ref, sourceField] = resolveOrderFieldRef(query, field)
  const data = ref.result?.value?.data
  return sourceField.includes(".") || data?.key !== sourceField || data.isNullable === true
}

/** Returns SQL for an order field, resolving simple selected-column aliases. */
export function orderFieldToSQL(query: ListQuery, field: string): string {
  return resolveOrderFieldRef(query, field)[0].toSQL()
}

/** Replaces ORDER BY with the tuple components used by cursor comparison. */
export function applyCursorOrder(query: ListQuery, orderFields: OrderField[]): ListQuery {
  const parts = orderFields.flatMap(([field, asc, nulls]) => {
    const columnSql = orderFieldToSQL(query, field)
    return [
      ...(orderFieldNeedsNullRank(query, field)
        ? [`(${columnSql} IS NULL) ${nulls === "LAST" ? "ASC" : "DESC"}`]
        : []),
      `${columnSql} ${asc ? "ASC" : "DESC"}`,
    ]
  })

  return query.clear("order").order(query.qb.sql({
    raw: parts.join(","),
    values: {},
  }) as never)
}
