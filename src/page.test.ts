import { describe, expect, test } from "bun:test"

import { db } from "#testing"

import { createPagePaginator, paginateByPage } from "./page"

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

describe("paginateByPage", () => {
  test("returns the first page with a next page", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2 })

    expect(userIds(page.items)).toEqual([1, 2])
    expect(page).toMatchObject({ page: 1, limit: 2, offset: 0, nextPage: 2 })
    expect(page.prevPage).toBeUndefined()
  })

  test("returns a middle page with prev and next pages", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
      { id: 4, name: "d", score: 40, group: "one" },
      { id: 5, name: "e", score: 50, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2 }, { page: 2 })

    expect(userIds(page.items)).toEqual([3, 4])
    expect(page).toMatchObject({ page: 2, limit: 2, offset: 2, prevPage: 1, nextPage: 3 })
  })

  test("returns the last page without a next page", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2 }, { page: 2 })

    expect(userIds(page.items)).toEqual([3])
    expect(page).toMatchObject({ page: 2, limit: 2, offset: 2, prevPage: 1 })
    expect(page.nextPage).toBeUndefined()
  })

  test("normalizes page values below one", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 1 }, { page: -10 })

    expect(userIds(page.items)).toEqual([1])
    expect(page).toMatchObject({ page: 1, limit: 1, offset: 0, nextPage: 2 })
    expect(page.prevPage).toBeUndefined()
  })

  test("clamps requested limit by config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { maxLimit: 2 }, { limit: 10 })

    expect(userIds(page.items)).toEqual([1, 2])
    expect(page.limit).toBe(2)
  })
})

describe("createPagePaginator", () => {
  test("creates a reusable paginator with config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const paginate = createPagePaginator({ limit: 2 })
    const page = await paginate(db.user.order({ id: "ASC" }))

    expect(userIds(page.items)).toEqual([1, 2])
    expect(page.nextPage).toBe(2)
  })
})
