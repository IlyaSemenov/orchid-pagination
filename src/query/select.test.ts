import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { getQuerySelectedKeys } from "./select"

describe("getQuerySelectedKeys", () => {
  test("returns default column keys when no select is set", () => {
    expect(getQuerySelectedKeys(db.user.all())).toEqual(new Set(["id", "name", "score", "group"]))
  })

  test("expands '*' without computed or relation fields", () => {
    expect(getQuerySelectedKeys(db.user.select("*"))).toEqual(new Set(["id", "name", "score", "group"]))
  })

  test("combines '*' with explicitly selected computed fields and aliases", () => {
    expect(getQuerySelectedKeys(db.user.select("*", "nameLabel", { label: "nameLabel" }))).toEqual(
      new Set(["id", "name", "score", "group", "nameLabel", "label"]),
    )
  })

  test("collects simple string column names", () => {
    expect(getQuerySelectedKeys(db.user.select("id", "name"))).toEqual(new Set(["id", "name"]))
  })

  test("uses the last segment of dotted string column names", () => {
    expect(getQuerySelectedKeys(db.user.select("user.id", "user.name"))).toEqual(new Set(["id", "name"]))
  })

  test("collects keys from { selectAs } object form", () => {
    expect(
      getQuerySelectedKeys(
        db.user.select("id", { score: q => q.get("score"), groupName: q => q.get("group") }),
      ),
    ).toEqual(new Set(["id", "score", "groupName"]))
  })
})
