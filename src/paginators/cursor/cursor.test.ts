import { describe, expect, test } from "bun:test"

import { createCursor, createDirectedCursor, parseCursor, parseDirectedCursor } from "./cursor"

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
