import type { OrderField } from "../../query"
import { queryFieldBindingToSQL, queryFieldRef, queryFieldToSQL } from "../../query"
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
  const components: [columnSql: string, valueSql: string, asc: boolean][] = []
  const rawSqlValues: Record<string, unknown> = {}

  orderFields.forEach(([field, asc, nulls], i) => {
    const columnSql = queryFieldToSQL(query, field)
    const part = parts[i]

    if (orderFieldNeedsNullRank(query, field) || part === null) {
      const nullRankKey = `null${i}`
      components.push([
        `(${columnSql} IS NULL)`,
        `$${nullRankKey}`,
        nulls === "LAST",
      ])
      rawSqlValues[nullRankKey] = part === null
    }

    if (part !== null) {
      const valueKey = `value${i}`
      // Keep postgres-js from applying the serializer inferred for the target
      // column before Bind; PostgreSQL casts the original cursor text instead.
      const valueSql = queryFieldBindingToSQL(queryFieldRef(query, field), `$${valueKey}`)
      components.push([columnSql, valueSql, asc])
      rawSqlValues[valueKey] = part
    }
  })

  const columnLeft = components.map(([columnSql, valueSql, asc]) => asc ? columnSql : valueSql).join(",")
  const columnRight = components.map(([columnSql, valueSql, asc]) => asc ? valueSql : columnSql).join(",")
  const leadingAsc = components[0]![2]
  const [leftRawSql, rightRawSql] = leadingAsc
    ? [columnLeft, columnRight]
    : [columnRight, columnLeft]
  const operator = reverse === leadingAsc ? "<" : ">"
  const comparison = `(${leftRawSql}) ${operator} (${rightRawSql})`
  const prefixEnd = components.findIndex(component => component[2] !== leadingAsc)
  const indexPrefix = prefixEnd === -1 ? components : components.slice(0, prefixEnd)
  // Keep the same-direction prefix indexable. CASE deliberately leaves the
  // mixed-direction tuple as a filter so PostgreSQL preserves the ordered scan.
  const rawSql = indexPrefix.length === components.length
    ? comparison
    : `(${indexPrefix.map(component => component[0]).join(",")}) ${operator}= `
      + `(${indexPrefix.map(component => component[1]).join(",")}) `
      + `AND CASE WHEN ${comparison} THEN true ELSE false END`
  return query.qb.sql({ raw: rawSql, values: rawSqlValues })
}
