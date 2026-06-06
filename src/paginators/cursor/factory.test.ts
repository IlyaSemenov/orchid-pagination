import { describe, expect, test } from "bun:test"

import { db, getIds, seedUsers } from "#testing"

import { createCursorPaginator } from "./factory"

describe("createCursorPaginator", () => {
  test("creates a reusable paginator with config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const paginate = createCursorPaginator({ limit: 2 })
    const page = await paginate(db.user.order({ id: "ASC" }))

    expect(getIds(page.items)).toEqual([1, 2])
    expect(page.nextCursor).toBeTypeOf("string")
  })
})
