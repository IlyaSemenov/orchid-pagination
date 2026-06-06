import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getQueryOrderFields } from "./order"

describe("getQueryOrderFields", () => {
  test("parses string order as ascending", () => {
    expect(getQueryOrderFields(db.user.order("name"))).toEqual([["name", true]])
  })

  test("parses object order directions", () => {
    expect(getQueryOrderFields(db.user.order({ score: "ASC", id: "DESC" }))).toEqual([
      ["score", true],
      ["id", false],
    ])
  })

  test("throws on unordered query", () => {
    expect(() => getQueryOrderFields(db.user.all())).toThrow("Query must be ordered.")
  })

  test("throws on unsupported order direction", () => {
    const query = db.user.order({ id: "ASC" })
    query.q.order = [{ id: "invalid" as any }]

    expect(() => getQueryOrderFields(query)).toThrow("Unsupported order: invalid")
  })
})
