import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getLimit } from "./limit"

describe("getLimit", () => {
  test("uses config limit by default", () => {
    const limit = getLimit(db.user.limit(10), { limit: 3, maxLimit: 5 })

    expect(limit).toBe(3)
  })

  test("ignores requested limit when maxLimit is not set", () => {
    const limit = getLimit(db.user.limit(10), { limit: 3 }, { limit: 8 })

    expect(limit).toBe(3)
  })

  test("clamps requested limit to maxLimit", () => {
    const limit = getLimit(db.user.limit(10), { limit: 3, maxLimit: 5 }, { limit: 8 })

    expect(limit).toBe(5)
  })

  test("clamps requested limit to at least one", () => {
    const limit = getLimit(db.user.limit(10), { maxLimit: 5 }, { limit: 0 })

    expect(limit).toBe(1)
  })

  test("allows maxLimit without config limit when params limit is set", () => {
    const limit = getLimit(db.user.limit(10), { maxLimit: 5 }, { limit: 3 })

    expect(limit).toBe(3)
  })

  test("throws for maxLimit without config limit or params limit", () => {
    expect(() => getLimit(db.user.limit(10), { maxLimit: 5 })).toThrow("Set config.limit")
  })

  test("uses query limit only when config is not set", () => {
    const limit = getLimit(db.user.limit(4))

    expect(limit).toBe(4)
  })

  test("uses config limit over query limit", () => {
    const limit = getLimit(db.user.limit(10), { limit: 4 })

    expect(limit).toBe(4)
  })

  test("throws when no limit source is available", () => {
    expect(() => getLimit(db.user.all())).toThrow("Set query limit")
  })
})
