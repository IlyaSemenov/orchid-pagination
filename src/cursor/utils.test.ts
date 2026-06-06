import { describe, expect, test } from "bun:test"
import type { SelectQueryData } from "orchid-orm"

import { db } from "#testing"

import { createCursor, createDirectedCursor, getQueryOrderFields, parseCursor, parseDirectedCursor } from "./utils"

describe("cursor encoding", () => {
  test("round-trips cursor parts", () => {
    const parts = ["foo", "bar", "baz"]
    const cursor = createCursor(parts)

    expect(cursor).toBeTypeOf("string")
    expect(parseCursor(cursor)).toEqual(parts)
  })

  test("preserves empty string parts", () => {
    const parts = ["foo", "", "baz"]
    const cursor = createCursor(parts)

    expect(parseCursor(cursor)).toEqual(parts)
  })
})

describe("directed cursor encoding", () => {
  test("round-trips forward cursor parts", () => {
    const cursor = createDirectedCursor(["1", "2"], false)
    const parsed = parseDirectedCursor(cursor)

    expect(parsed.cursor).toBeTypeOf("string")
    expect(parsed.parts).toEqual(["1", "2"])
    expect(parsed.reverse).toBe(false)
  })

  test("round-trips reverse cursor parts", () => {
    const cursor = createDirectedCursor(["1", "2"], true)
    const parsed = parseDirectedCursor(cursor)

    expect(parsed.cursor).toBeTypeOf("string")
    expect(parsed.parts).toEqual(["1", "2"])
    expect(parsed.reverse).toBe(true)
  })
})

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
    ;(query.q as SelectQueryData).order = [{ id: "invalid" as any }]

    expect(() => getQueryOrderFields(query)).toThrow("Unsupported order: invalid")
  })
})
