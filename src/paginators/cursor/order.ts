import type { OrderField } from "../../query"
import { queryFieldRef, resolveQueryFieldRef } from "../../query"
import type { ListQuery } from "../../types"

/** Returns true unless Orchid identifies the field as a direct NOT NULL column. */
export function orderFieldNeedsNullRank(query: ListQuery, field: string): boolean {
  const [ref, sourceField] = resolveQueryFieldRef(query, field)
  const data = ref.result?.value?.data
  return sourceField.includes(".") || data?.key !== sourceField || data.isNullable === true
}

/** Replaces ORDER BY with the tuple components used by cursor comparison. */
export function applyCursorOrder(query: ListQuery, orderFields: OrderField[]): ListQuery {
  const parts = orderFields.flatMap(([field, asc, nulls]) => {
    const columnSql = queryFieldRef(query, field)
    return [
      ...(orderFieldNeedsNullRank(query, field)
        ? [query.qb.sql`(${columnSql} IS NULL) ${query.qb.sql({ raw: nulls === "LAST" ? "ASC" : "DESC" })}`]
        : []),
      query.qb.sql`${columnSql} ${query.qb.sql({ raw: asc ? "ASC" : "DESC" })}`,
    ]
  })

  return query.clear("order").order(...parts as never[])
}
