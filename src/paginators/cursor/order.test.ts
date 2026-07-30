import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getQueryOrderFields } from "../../query"

import { applyCursorOrder } from "./order"

describe("applyCursorOrder", () => {
  test("expands nullable fields with the null marker used by cursor comparison", () => {
    const query = db.user.order({ score: "ASC", id: "DESC" })
    const ordered = applyCursorOrder(query, getQueryOrderFields(query))
    const sql = (ordered as never as { toSQL(): { text: string } }).toSQL()

    expect(sql.text).toBe(
      `SELECT * FROM "user" ORDER BY ("user"."score" IS NULL) ASC,"user"."score" ASC,"user"."id" DESC`,
    )
  })

  test("reverses the same index components for backward pagination", () => {
    const query = db.user.order({ score: "ASC", id: "DESC" })
    const orderFields = getQueryOrderFields(query)
    orderFields.forEach((field) => {
      field[1] = !field[1]
      field[2] = field[2] === "FIRST" ? "LAST" : "FIRST"
    })

    const ordered = applyCursorOrder(query, orderFields)
    const sql = (ordered as never as { toSQL(): { text: string } }).toSQL()

    expect(sql.text).toBe(
      `SELECT * FROM "user" ORDER BY ("user"."score" IS NULL) DESC,"user"."score" DESC,"user"."id" ASC`,
    )
  })

  test("resolves a selected-column alias to its source column", () => {
    const query = db.user
      .select("id", { s: "score" })
      .order({ s: "ASC", id: "DESC" })
    const ordered = applyCursorOrder(query, getQueryOrderFields(query))
    const sql = (ordered as never as { toSQL(): { text: string } }).toSQL()

    expect(sql.text).toBe(
      `SELECT "user"."id", "user"."score" "s" FROM "user" ORDER BY ("user"."score" IS NULL) ASC,"user"."score" ASC,"user"."id" DESC`,
    )
  })

  test("rejects a selected raw SQL expression alias", () => {
    const query = (db.user
      .select("id", {
        up: (q: any) => q.sql`upper(${q.column("name")})`.type((t: any) => t.text()),
      }) as any)
      .order({ up: "ASC", id: "DESC" })

    expect(() => applyCursorOrder(query, getQueryOrderFields(query))).toThrow(
      `Cannot order by selected expression alias "up" in cursor pagination because it is not available in WHERE.`,
    )
  })

  test("rejects a selected expression alias that shadows a column", () => {
    const query = (db.user
      .select("id", {
        score: (q: any) => q.sql`-${q.column("score")}`.type((t: any) => t.integer()),
      }) as any)
      .order({ score: "ASC", id: "DESC" })

    expect(() => applyCursorOrder(query, getQueryOrderFields(query))).toThrow(
      `Cannot order by selected expression alias "score" in cursor pagination because it is not available in WHERE.`,
    )
  })
})
