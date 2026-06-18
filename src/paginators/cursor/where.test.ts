import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getQueryOrderFields } from "../../query"
import type { ListQuery } from "../../types"

import { buildCursorWhere } from "./where"

/** sqlOf builds the seek condition and returns the resulting WHERE clause SQL and values. */
function sqlOf(query: ListQuery, parts: string[]) {
  const orderFields = getQueryOrderFields(query)
  const expr = buildCursorWhere(query, orderFields, parts)
  const { text, values } = (query.where(expr as never) as never as { toSQL(): { text: string, values: unknown[] } }).toSQL()
  // Keep only the WHERE clause to make assertions resilient to SELECT/ORDER BY.
  const start = text.indexOf("WHERE ")
  const end = text.indexOf(" ORDER BY", start)
  const where = text.slice(start, end === -1 ? undefined : end)
  return { where, values }
}

describe("buildCursorWhere", () => {
  test("compares as a single row-value for an all-ascending order", () => {
    const { where, values } = sqlOf(db.user.order({ score: "ASC", id: "ASC" }), ["10", "5"])

    expect(where).toBe(`WHERE (("user"."score","user"."id") > ($1,$2))`)
    expect(values).toEqual(["10", "5"])
  })

  test("flips column and value sides per field for mixed directions", () => {
    // For (score ASC, id DESC): ascending fields stay as column refs on the left
    // and descending fields move to the right, so a single `>` expresses the seek.
    const { where, values } = sqlOf(db.user.order({ score: "ASC", id: "DESC" }), ["10", "5"])

    expect(where).toBe(`WHERE (("user"."score",$1) > ($2,"user"."id"))`)
    expect(values).toEqual(["5", "10"])
  })

  test("handles a single descending field", () => {
    const { where, values } = sqlOf(db.user.order({ id: "DESC" }), ["7"])

    expect(where).toBe(`WHERE (($1) > ("user"."id"))`)
    expect(values).toEqual(["7"])
  })
})
