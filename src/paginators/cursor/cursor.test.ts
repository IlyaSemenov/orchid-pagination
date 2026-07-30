import { Buffer } from "node:buffer"

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

  test("preserves nulls and null bytes", () => {
    const parts = [null, "null", "foo\0bar"]
    const cursor = createCursor(parts)

    expect(parseCursor(cursor)).toEqual(parts)
  })

  test("rejects invalid JSON cursor payloads", () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")

    expect(parseCursor("not-json")).toBeUndefined()
    expect(parseCursor(encode("abcdef"))).toBeUndefined()
    expect(parseCursor(encode({ length: 5 }))).toBeUndefined()
    expect(parseCursor(encode(["1", 2]))).toBeUndefined()
  })
})

describe("directed cursor encoding", () => {
  test("round-trips forward cursor parts", () => {
    const cursor = createDirectedCursor(["1", "2"], false)
    const parsed = parseDirectedCursor(cursor)

    expect(parsed?.cursor).toBeTypeOf("string")
    expect(parsed?.parts).toEqual(["1", "2"])
    expect(parsed?.reverse).toBe(false)
  })

  test("round-trips reverse cursor parts", () => {
    const cursor = createDirectedCursor(["1", "2"], true)
    const parsed = parseDirectedCursor(cursor)

    expect(parsed?.cursor).toBeTypeOf("string")
    expect(parsed?.parts).toEqual(["1", "2"])
    expect(parsed?.reverse).toBe(true)
  })
})
