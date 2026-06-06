import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { createCursorPaginator, paginateByCursor } from "./cursor"

type UserSeed = {
  id: number
  name: string
  score: number
  group: string
}

async function seedUsers(rows: UserSeed[]) {
  return await db.user.insertMany(rows).pluck("id")
}

function userIds(items: Array<{ id: number }>) {
  return items.map(item => item.id)
}

describe("paginateByCursor", () => {
  test("throws for unordered queries", async () => {
    await expect(paginateByCursor(db.user.all(), { pageSize: 2 })).rejects.toThrow("Query must be ordered.")
  })

  test("paginates forward with single-field ascending order", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ id: "ASC" }), { pageSize: 2 })
    const second = await paginateByCursor(db.user.order({ id: "ASC" }), { pageSize: 2 }, { cursor: first.nextCursor })

    expect(userIds(first.items)).toEqual([1, 2])
    expect(first.prevCursor).toBeUndefined()
    expect(first.nextCursor).toBeTypeOf("string")
    expect(userIds(second.items)).toEqual([3])
    expect(second.prevCursor).toBeTypeOf("string")
    expect(second.nextCursor).toBeUndefined()
  })

  test("paginates forward with single-field descending order", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ id: "DESC" }), { pageSize: 2 })
    const second = await paginateByCursor(db.user.order({ id: "DESC" }), { pageSize: 2 }, { cursor: first.nextCursor })

    expect(userIds(first.items)).toEqual([3, 2])
    expect(userIds(second.items)).toEqual([1])
  })

  test("uses tie-breaker fields for stable ordering", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 10, group: "one" },
      { id: 3, name: "c", score: 20, group: "one" },
      { id: 4, name: "d", score: 20, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ score: "ASC", id: "ASC" }), { pageSize: 2 })
    const second = await paginateByCursor(db.user.order({ score: "ASC", id: "ASC" }), { pageSize: 2 }, { cursor: first.nextCursor })

    expect(userIds(first.items)).toEqual([1, 2])
    expect(userIds(second.items)).toEqual([3, 4])
    expect(second.nextCursor).toBeUndefined()
  })

  test("supports mixed order directions", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 10, group: "one" },
      { id: 3, name: "c", score: 20, group: "one" },
      { id: 4, name: "d", score: 20, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ score: "ASC", id: "DESC" }), { pageSize: 3 })
    const second = await paginateByCursor(db.user.order({ score: "ASC", id: "DESC" }), { pageSize: 3 }, { cursor: first.nextCursor })

    expect(userIds(first.items)).toEqual([2, 1, 4])
    expect(userIds(second.items)).toEqual([3])
  })

  test("uses prevCursor to page backward in display order", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
      { id: 4, name: "d", score: 40, group: "one" },
      { id: 5, name: "e", score: 50, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ id: "ASC" }), { pageSize: 2 })
    const second = await paginateByCursor(db.user.order({ id: "ASC" }), { pageSize: 2 }, { cursor: first.nextCursor })
    const back = await paginateByCursor(db.user.order({ id: "ASC" }), { pageSize: 2 }, { cursor: second.prevCursor })

    expect(userIds(first.items)).toEqual([1, 2])
    expect(userIds(second.items)).toEqual([3, 4])
    expect(userIds(back.items)).toEqual([1, 2])
    expect(back.prevCursor).toBeUndefined()
    expect(back.nextCursor).toBeTypeOf("string")
  })

  test("clamps requested size by config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByCursor(db.user.order({ id: "ASC" }), { maxPageSize: 2 }, { size: 10 })

    expect(userIds(page.items)).toEqual([1, 2])
    expect(page.size).toBe(2)
  })
})

describe("createCursorPaginator", () => {
  test("creates a reusable paginator with config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const paginate = createCursorPaginator({ pageSize: 2 })
    const page = await paginate(db.user.order({ id: "ASC" }))

    expect(userIds(page.items)).toEqual([1, 2])
    expect(page.nextCursor).toBeTypeOf("string")
  })
})
