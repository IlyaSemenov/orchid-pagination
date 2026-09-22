import type { OrderField } from "../../query"
import { queryFieldRef } from "../../query"
import type { ListQuery } from "../../types"

import type { CursorPart } from "./cursor"
import { orderFieldNeedsNullRank } from "./order"

/**
 * buildCursorWhere builds the row-value seek condition that keeps only rows
 * strictly after the cursor in the current order direction.
 *
 * Nullable and unknown fields are prefixed with a boolean NULL rank, so
 * row-value comparison remains deterministic without comparing NULL directly.
 * Direct fields known to be NOT NULL keep the original single component.
 *
 * Value components use the existing side-swap trick for mixed ASC/DESC order.
 * When the cursor value is NULL, its value component is omitted and comparison
 * proceeds from the NULL rank directly to the next order field.
 */
export function buildCursorWhere(query: ListQuery, orderFields: OrderField[], parts: CursorPart[], reverse = false): unknown {
  const components = orderFields.flatMap(([field, asc, nulls], i) => {
    const columnSql = queryFieldRef(query, field)
    const part = parts[i]
    const fieldComponents = []

    if (orderFieldNeedsNullRank(query, field) || part === null) {
      fieldComponents.push({
        columnSql: query.qb.sql`(${columnSql} IS NULL)`,
        valueSql: query.qb.sql`${part === null}`,
        asc: nulls === "LAST",
      })
    }

    if (part !== null) {
      // Keep postgres-js from applying the serializer inferred for the target
      // column before Bind; PostgreSQL casts the original cursor text instead.
      const dataType = columnSql.result?.value?.dataType
      fieldComponents.push({
        columnSql,
        valueSql: dataType ? query.qb.sql`${part}::text::${query.qb.sql({ raw: dataType })}` : query.qb.sql`${part}`,
        asc,
      })
    }

    return fieldComponents
  })

  const tuple = (items: typeof components[number]["columnSql"][]) => {
    const joined = items.slice(1).reduce((result, item) => query.qb.sql`${result},${item}`, items[0]!)
    return query.qb.sql`(${joined})`
  }
  const leadingAsc = components[0]!.asc
  const columnLeft = components.map(({ columnSql, valueSql, asc }) => asc ? columnSql : valueSql)
  const columnRight = components.map(({ columnSql, valueSql, asc }) => asc ? valueSql : columnSql)
  const [left, right] = leadingAsc ? [columnLeft, columnRight] : [columnRight, columnLeft]
  const operator = reverse === leadingAsc ? "<" : ">"
  const comparison = query.qb.sql`${tuple(left)} ${query.qb.sql({ raw: operator })} ${tuple(right)}`
  const prefixEnd = components.findIndex(component => component.asc !== leadingAsc)
  const indexPrefix = prefixEnd === -1 ? components : components.slice(0, prefixEnd)
  // Keep the same-direction prefix indexable. CASE deliberately leaves the
  // mixed-direction tuple as a filter so PostgreSQL preserves the ordered scan.
  return indexPrefix.length === components.length
    ? comparison
    : query.qb.sql`${tuple(indexPrefix.map(component => component.columnSql))} ${query.qb.sql({ raw: operator + "=" })} ${tuple(indexPrefix.map(component => component.valueSql))} AND CASE WHEN ${comparison} THEN true ELSE false END`
}
