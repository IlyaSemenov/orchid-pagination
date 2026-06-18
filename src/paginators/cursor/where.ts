import type { OrderField } from "../../query"
import type { ListQuery } from "../../types"

/**
 * buildCursorWhere builds the row-value seek condition that keeps only rows
 * strictly after the cursor in the current order direction.
 *
 * For example, for (amount ASC, id DESC) ordering it produces:
 *
 *     (amount, $value1) > ($value0, id)
 *
 * Ascending fields go on the left side of the comparison and descending fields
 * on the right, so that a single `>` expresses the mixed-direction seek.
 */
export function buildCursorWhere(query: ListQuery, orderFields: OrderField[], parts: string[]): unknown {
  const leftRawSql = orderFields.map(([field, asc], i) => asc ? query.ref(field).toSQL() : `$value${i}`).join(",")
  const rightRawSql = orderFields.map(([field, asc], i) => !asc ? query.ref(field).toSQL() : `$value${i}`).join(",")
  const rawSql = `(${leftRawSql}) > (${rightRawSql})`
  const rawSqlValues = Object.fromEntries(
    orderFields.map((_field, i) => [`value${i}`, parts[i]]),
  )
  return query.qb.sql({ raw: rawSql, values: rawSqlValues })
}
