import { expect, test } from "bun:test"

import { createCursor, parseCursor } from "./utils"

test("createCursor", () => {
  const parts = ["foo", "bar", "baz"]
  const cursor = createCursor(parts)
  expect(cursor).toBeTypeOf("string")
  expect(parseCursor(cursor)).toEqual(parts)
})
