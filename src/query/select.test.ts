import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getQuerySelectedKeys } from "./select"

describe("getQuerySelectedKeys", () => {
  test("returns all=true when no select is set", () => {
    expect(getQuerySelectedKeys(db.user.all() as never)).toEqual({ all: true, keys: new Set() })
  })

  test("returns all=true and empty keys for '*'", () => {
    expect(getQuerySelectedKeys(db.user.select("*") as never)).toEqual({ all: true, keys: new Set() })
  })

  test("returns all=true when '*' is mixed in with other columns", () => {
    expect(getQuerySelectedKeys(db.user.select("id", "*") as never)).toEqual({
      all: true,
      keys: new Set(["id"]),
    })
  })

  test("collects simple string column names", () => {
    expect(getQuerySelectedKeys(db.user.select("id", "name") as never)).toEqual({
      all: false,
      keys: new Set(["id", "name"]),
    })
  })

  test("uses the last segment of dotted string column names", () => {
    expect(getQuerySelectedKeys(db.user.select("user.id", "user.name") as never)).toEqual({
      all: false,
      keys: new Set(["id", "name"]),
    })
  })

  test("collects keys from { selectAs } object form", () => {
    expect(
      getQuerySelectedKeys(
        db.user.select("id", { score: q => q.get("score"), groupName: q => q.get("group") }) as never,
      ),
    ).toEqual({ all: false, keys: new Set(["id", "score", "groupName"]) })
  })
})
