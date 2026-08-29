import type { ListQuery } from "../types"

/**
 * Minimal ref metadata shape reverse-engineered from and verified against
 * Orchid ORM 1.68.5.
 */
export type QueryFieldRef = {
  toSQL(): string
  result?: {
    value?: {
      dataType?: string
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

/**
 * Resolves a field identifier used in an Orchid query clause to its Orchid ref
 * and underlying source field.
 * A field identifier can be a column name, dotted relation path, or selected alias.
 *
 * Simple selected-column aliases resolve to the source column ref.
 * Other selected aliases are accepted only when Orchid exposes a ref that can
 * be used outside SELECT; otherwise this function throws.
 * Fields without a matching select alias resolve directly through query.ref.
 *
 * The returned source field is used when column metadata must be matched to
 * the field represented by the ref.
 */
export function resolveQueryFieldRef(query: ListQuery, field: string): [ref: QueryFieldRef, sourceField: string] {
  const select = query.q.select as unknown[] | undefined
  for (const item of select ?? []) {
    const source = typeof item === "object" && item
      ? (item as SelectAsItem).selectAs?.[field]
      : undefined
    if (source === undefined) {
      continue
    }
    if (typeof source === "string") {
      return [query.ref(source) as unknown as QueryFieldRef, source]
    }

    const ref = query.ref(field) as unknown as QueryFieldRef
    const quotedField = `"${field.replaceAll("\"", "\"\"")}"`
    const refSql = ref.toSQL()
    const selectedAliasSql = `${quotedField}.${quotedField}`
    // Orchid ORM 1.78.5 represents a selected scalar relation as a one-element
    // array, so its WHERE-safe alias reference has a `[1]` suffix.
    if (refSql !== selectedAliasSql && refSql !== `${selectedAliasSql}[1]`) {
      throw new Error(`Cannot reference selected expression alias "${field}" outside SELECT.`)
    }
    return [ref, field]
  }

  return [query.ref(field) as unknown as QueryFieldRef, field]
}

/** Returns the Orchid ref for a query field, resolving simple selected-column aliases. */
export function queryFieldRef(query: ListQuery, field: string): QueryFieldRef {
  return resolveQueryFieldRef(query, field)[0]
}

/** Returns SQL for a query field, resolving simple selected-column aliases. */
export function queryFieldToSQL(query: ListQuery, field: string): string {
  return queryFieldRef(query, field).toSQL()
}

/** Casts a text binding to the PostgreSQL type reported by Orchid. */
export function queryFieldBindingToSQL(ref: QueryFieldRef, bindingSql: string): string {
  const dataType = ref.result?.value?.dataType
  return dataType ? `${bindingSql}::text::${dataType}` : bindingSql
}
