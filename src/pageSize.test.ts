import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getPageSize } from "./pageSize"

describe("getPageSize", () => {
  test("uses config pageSize by default", () => {
    const size = getPageSize(db.user.limit(10), { pageSize: 3, maxPageSize: 5 })

    expect(size).toBe(3)
  })

  test("clamps requested size to maxPageSize", () => {
    const size = getPageSize(db.user.limit(10), { pageSize: 3, maxPageSize: 5 }, { size: 8 })

    expect(size).toBe(5)
  })

  test("clamps requested size to at least one", () => {
    const size = getPageSize(db.user.limit(10), { maxPageSize: 5 }, { size: 0 })

    expect(size).toBe(1)
  })

  test("uses query limit as fallback max size", () => {
    const size = getPageSize(db.user.limit(4))

    expect(size).toBe(4)
  })

  test("throws when no max size source is available", () => {
    expect(() => getPageSize(db.user.all())).toThrow("Set query limit")
  })
})
