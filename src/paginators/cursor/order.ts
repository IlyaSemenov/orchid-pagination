import type { OrderField } from "../../query"
import { queryFieldToSQL, resolveQueryFieldRef } from "../../query"
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
    const columnSql = queryFieldToSQL(query, field)
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
