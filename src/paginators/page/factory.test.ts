import { describe, expect, expectTypeOf, test } from "bun:test"

import { db, getIds, seedUsers } from "#testing"

import { createPagePaginator } from "./factory"
import type { PagePaginationPage, PagePaginationPageWithTotal } from "./paginator"

describe("createPagePaginator", () => {
  test("creates a reusable paginator with config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const paginate = createPagePaginator({ limit: 2 })
    const page = await paginate(db.user.order({ id: "ASC" }))

    expect(getIds(page.items)).toEqual([1, 2])
    expect(page.nextPage).toBe(2)
  })

  test("creates a reusable paginator with total: true", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const paginate = createPagePaginator({ limit: 2, total: true })
    const page = await paginate(db.user.order({ id: "ASC" }))

    expect(getIds(page.items)).toEqual([1, 2])
    expect(page).toMatchObject({ page: 1, limit: 2, offset: 0, nextPage: 2, totalItems: 3, totalPages: 2 })
    expect(page.prevPage).toBeUndefined()
  })

  test("without total returns PagePaginationPage type", () => {
    const paginate = createPagePaginator({ limit: 10 })
    const result = paginate(db.user)
    expectTypeOf(result).resolves.toExtend<PagePaginationPage>()
    expectTypeOf(result).resolves.not.toExtend<PagePaginationPageWithTotal>()
  })

  test("with total: true returns PagePaginationPageWithTotal type", () => {
    const paginate = createPagePaginator({ limit: 10, total: true })
    const result = paginate(db.user)
    expectTypeOf(result).resolves.toExtend<PagePaginationPageWithTotal>()
    expectTypeOf(result).resolves.toHaveProperty("totalItems")
    expectTypeOf(result).resolves.toHaveProperty("totalPages")
  })
})
