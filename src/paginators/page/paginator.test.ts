import { describe, expect, expectTypeOf, test } from "bun:test"

import { db, getIds, seedUsers } from "#testing"

import { type PagePaginationPage, type PagePaginationPageWithTotal, paginateByPage } from "./paginator"

describe("paginateByPage", () => {
  test("returns the first page with a next page", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2 })

    expect(getIds(page.items)).toEqual([1, 2])
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

    expect(getIds(page.items)).toEqual([3, 4])
    expect(page).toMatchObject({ page: 2, limit: 2, offset: 2, prevPage: 1, nextPage: 3 })
  })

  test("returns the last page without a next page", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2 }, { page: 2 })

    expect(getIds(page.items)).toEqual([3])
    expect(page).toMatchObject({ page: 2, limit: 2, offset: 2, prevPage: 1 })
    expect(page.nextPage).toBeUndefined()
  })

  test("normalizes page values below one", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 1 }, { page: -10 })

    expect(getIds(page.items)).toEqual([1])
    expect(page).toMatchObject({ page: 1, limit: 1, offset: 0, nextPage: 2 })
    expect(page.prevPage).toBeUndefined()
  })

  test("returns empty items for a page beyond available data", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    // 3 items with limit 2 = 2 pages; requesting page 5
    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2 }, { page: 5 })

    expect(page.items).toEqual([])
    expect(page).toMatchObject({ page: 5, limit: 2, offset: 8, prevPage: 4 })
    expect(page.nextPage).toBeUndefined()
  })

  test("with total: true, includes total and totalPages", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
      { id: 4, name: "d", score: 40, group: "one" },
      { id: 5, name: "e", score: 50, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2, total: true }, { page: 2 })

    expect(getIds(page.items)).toEqual([3, 4])
    expect(page).toMatchObject({ page: 2, limit: 2, offset: 2, prevPage: 1, nextPage: 3, totalItems: 5, totalPages: 3 })
  })

  test("with total: true without clampPage, does not clamp page beyond last", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    // 3 items with limit 2 = 2 pages; requesting page 10
    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2, total: true }, { page: 10 })

    expect(page.items).toEqual([])
    expect(page).toMatchObject({ page: 10, limit: 2, offset: 18, prevPage: 9, totalItems: 3, totalPages: 2 })
    expect(page.nextPage).toBeUndefined()
  })

  test("with total: true and clampPage: true, clamps page to last when requested beyond", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    // 3 items with limit 2 = 2 pages; requesting page 10
    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2, total: true, clampPage: true }, { page: 10 })

    expect(getIds(page.items)).toEqual([3])
    expect(page).toMatchObject({ page: 2, limit: 2, offset: 2, prevPage: 1, totalItems: 3, totalPages: 2 })
    expect(page.nextPage).toBeUndefined()
  })

  test("with total: true, handles empty table", async () => {
    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 2, total: true })

    expect(page.items).toEqual([])
    expect(page).toMatchObject({ page: 1, limit: 2, offset: 0, totalItems: 0, totalPages: 1 })
    expect(page.prevPage).toBeUndefined()
    expect(page.nextPage).toBeUndefined()
  })

  test("with total: true, single-page result", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { limit: 5, total: true })

    expect(getIds(page.items)).toEqual([1, 2])
    expect(page).toMatchObject({ page: 1, limit: 5, offset: 0, totalItems: 2, totalPages: 1 })
    expect(page.prevPage).toBeUndefined()
    expect(page.nextPage).toBeUndefined()
  })

  test("without total returns PagePaginationPage type", () => {
    const result = paginateByPage(db.user, { limit: 10 })
    expectTypeOf(result).resolves.toExtend<PagePaginationPage>()
    expectTypeOf(result).resolves.not.toExtend<PagePaginationPageWithTotal>()
  })

  test("with total: true returns PagePaginationPageWithTotal type", () => {
    const result = paginateByPage(db.user, { limit: 10, total: true })
    expectTypeOf(result).resolves.toExtend<PagePaginationPageWithTotal>()
    expectTypeOf(result).resolves.toHaveProperty("totalItems")
    expectTypeOf(result).resolves.toHaveProperty("totalPages")
  })

  test("clampPage requires total: true", () => {
    // @ts-expect-error — clampPage is not valid without total: true
    paginateByPage(db.user, { limit: 10, clampPage: true })
    expectTypeOf(paginateByPage<typeof db.user>).toBeCallableWith(db.user, { limit: 10, total: true, clampPage: true })
  })

  test("clamps requested limit by config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByPage(db.user.order({ id: "ASC" }), { maxLimit: 2 }, { limit: 10 })

    expect(getIds(page.items)).toEqual([1, 2])
    expect(page.limit).toBe(2)
  })
})
