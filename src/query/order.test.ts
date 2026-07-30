import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getQueryOrderFields } from "./order"

describe("getQueryOrderFields", () => {
  test("parses string order as ascending", () => {
    expect(getQueryOrderFields(db.user.order("name"))).toEqual([["name", true, "LAST"]])
  })

  test("parses default null order directions", () => {
    expect(getQueryOrderFields(db.user.order({ score: "ASC", id: "DESC" }))).toEqual([
      ["score", true, "LAST"],
      ["id", false, "FIRST"],
    ])
  })

  test("parses explicit null order directions", () => {
    expect(getQueryOrderFields(db.user.order({ score: "ASC NULLS FIRST", id: "DESC NULLS LAST" }))).toEqual([
      ["score", true, "FIRST"],
      ["id", false, "LAST"],
    ])
  })

  test("returns an empty array for an unordered query", () => {
    expect(getQueryOrderFields(db.user.all())).toEqual([])
  })

  test("throws on unsupported order direction", () => {
    const query = db.user.order({ id: "ASC" })
    query.q.order = [{ id: "invalid" as any }]

    expect(() => getQueryOrderFields(query)).toThrow("Unsupported order: invalid")
  })
})
