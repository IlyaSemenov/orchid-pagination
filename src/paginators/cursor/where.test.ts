import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getQueryOrderFields } from "../../query"
import type { ListQuery } from "../../types"

import type { CursorPart } from "./cursor"
import { buildCursorWhere } from "./where"

/** sqlOf builds the seek condition and returns the resulting WHERE clause SQL and values. */
function sqlOf(query: ListQuery, parts: CursorPart[], reverse = false) {
  const orderFields = getQueryOrderFields(query)
  const expr = buildCursorWhere(query, orderFields, parts, reverse)
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

    expect(where).toBe(`WHERE ((("user"."score" IS NULL),"user"."score","user"."id") > ($1,$2,$3))`)
    expect(values).toEqual([false, "10", "5"])
  })

  test("flips column and value sides per field for mixed directions", () => {
    const { where, values } = sqlOf(db.user.order({ score: "ASC", id: "DESC" }), ["10", "5"])

    expect(where).toBe(
      `WHERE ((("user"."score" IS NULL),"user"."score") >= ($1,$2) `
      + `AND CASE WHEN (("user"."score" IS NULL),"user"."score",$3) > ($4,$5,"user"."id") `
      + `THEN true ELSE false END)`,
    )
    expect(values).toEqual([false, "10", "5", false, "10"])
  })

  test("does not add a null rank for a non-nullable field", () => {
    const { where, values } = sqlOf(db.user.order({ id: "DESC" }), ["7"])

    expect(where).toBe(`WHERE (("user"."id") < ($1))`)
    expect(values).toEqual(["7"])
  })

  test("omits a value component when the cursor part is null", () => {
    const { where, values } = sqlOf(db.user.order({ score: "ASC", id: "DESC" }), [null, "5"])

    expect(where).toBe(
      `WHERE ((("user"."score" IS NULL)) >= ($1) `
      + `AND CASE WHEN (("user"."score" IS NULL),$2) > ($3,"user"."id") `
      + `THEN true ELSE false END)`,
    )
    expect(values).toEqual([true, "5", true])
  })

  test("supports explicit null ordering", () => {
    const first = sqlOf(db.user.order({ score: "ASC NULLS FIRST" }), ["10"])
    const last = sqlOf(db.user.order({ score: "DESC NULLS LAST" }), ["10"])

    expect(first.where).toBe(
      `WHERE ((("user"."score" IS NULL)) <= ($1) `
      + `AND CASE WHEN (("user"."score" IS NULL),$2) < ($3,"user"."score") `
      + `THEN true ELSE false END)`,
    )
    expect(first.values).toEqual([false, "10", false])
    expect(last.where).toBe(
      `WHERE ((("user"."score" IS NULL)) >= ($1) `
      + `AND CASE WHEN (("user"."score" IS NULL),$2) > ($3,"user"."score") `
      + `THEN true ELSE false END)`,
    )
    expect(last.values).toEqual([false, "10", false])
  })

  test("keeps index expressions on the left when paginating backward", () => {
    const { where, values } = sqlOf(db.user.order({ score: "ASC", id: "DESC" }), ["10", "5"], true)

    expect(where).toBe(
      `WHERE ((("user"."score" IS NULL),"user"."score") <= ($1,$2) `
      + `AND CASE WHEN (("user"."score" IS NULL),"user"."score",$3) < ($4,$5,"user"."id") `
      + `THEN true ELSE false END)`,
    )
    expect(values).toEqual([false, "10", "5", false, "10"])
  })
})
