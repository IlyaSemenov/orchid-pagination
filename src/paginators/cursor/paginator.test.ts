import { describe, expect, test } from "bun:test"

import { db, getIds, seedPosts, seedUsers } from "#testing"

import { paginateByCursor } from "./paginator"

describe("paginateByCursor", () => {
  test("throws for unordered queries", async () => {
    await expect(paginateByCursor(db.user.all(), { limit: 2 })).rejects.toThrow("Query must be ordered.")
  })

  test("throws when an order field is not selected", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    // score is ordered by but not selected, so it's missing from the result rows.
    const query = db.user.select("id", "name").order({ score: "DESC", id: "DESC" })

    await expect(paginateByCursor(query, { limit: 1 })).rejects.toThrow(
      "Order field \"score\" is missing from the result — cursor pagination requires every order field to be selected.",
    )
  })

  test("paginates forward with single-field ascending order", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ id: "ASC" }), { limit: 2 })
    const second = await paginateByCursor(db.user.order({ id: "ASC" }), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([1, 2])
    expect(first.prevCursor).toBeUndefined()
    expect(first.nextCursor).toBeTypeOf("string")
    expect(getIds(second.items)).toEqual([3])
    expect(second.prevCursor).toBeTypeOf("string")
    expect(second.nextCursor).toBeUndefined()
  })

  test("paginates forward with single-field descending order", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ id: "DESC" }), { limit: 2 })
    const second = await paginateByCursor(db.user.order({ id: "DESC" }), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([3, 2])
    expect(getIds(second.items)).toEqual([1])
  })

  test("uses tie-breaker fields for stable ordering", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 10, group: "one" },
      { id: 3, name: "c", score: 20, group: "one" },
      { id: 4, name: "d", score: 20, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ score: "ASC", id: "ASC" }), { limit: 2 })
    const second = await paginateByCursor(db.user.order({ score: "ASC", id: "ASC" }), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([1, 2])
    expect(getIds(second.items)).toEqual([3, 4])
    expect(second.nextCursor).toBeUndefined()
  })

  test("supports mixed order directions", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 10, group: "one" },
      { id: 3, name: "c", score: 20, group: "one" },
      { id: 4, name: "d", score: 20, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ score: "ASC", id: "DESC" }), { limit: 3 })
    const second = await paginateByCursor(db.user.order({ score: "ASC", id: "DESC" }), { limit: 3 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([2, 1, 4])
    expect(getIds(second.items)).toEqual([3])
  })

  test("paginates forward ordered by a relation column", async () => {
    await seedUsers([
      { id: 1, name: "Alice", score: 10, group: "one" },
      { id: 2, name: "Bob", score: 20, group: "one" },
      { id: 3, name: "Carol", score: 30, group: "one" },
    ])
    await seedPosts([
      { id: 1, authorId: 1, text: "Alice first" },
      { id: 2, authorId: 1, text: "Alice second" },
      { id: 3, authorId: 2, text: "Bob first" },
      { id: 4, authorId: 3, text: "Carol first" },
      { id: 5, authorId: 3, text: "Carol second" },
    ])

    const query = () => db.post
      .select("id", "text", {
        author: q => q.author.select("id", "name"),
      })
      .order("author.name", { id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([2, 1])
    expect(first.nextCursor).toBeTypeOf("string")
    expect(getIds(second.items)).toEqual([3, 5])
  })

  test("paginates forward ordered by a relation column alias", async () => {
    await seedUsers([
      { id: 1, name: "Alice", score: 10, group: "one" },
      { id: 2, name: "Bob", score: 20, group: "one" },
      { id: 3, name: "Carol", score: 30, group: "one" },
    ])
    await seedPosts([
      { id: 1, authorId: 1, text: "Alice first" },
      { id: 2, authorId: 1, text: "Alice second" },
      { id: 3, authorId: 2, text: "Bob first" },
      { id: 4, authorId: 3, text: "Carol first" },
      { id: 5, authorId: 3, text: "Carol second" },
    ])

    const query = () => db.post
      .select("id", "text", {
        authorName: q => q.author.get("name"),
      })
      .order("authorName", { id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([2, 1])
    expect(first.nextCursor).toBeTypeOf("string")
    expect(getIds(second.items)).toEqual([3, 5])
  })

  test("paginates forward ordered by a relation aggregate alias", async () => {
    await seedUsers([
      { id: 1, name: "Alice", score: 10, group: "one" },
      { id: 2, name: "Bob", score: 20, group: "one" },
      { id: 3, name: "Carol", score: 30, group: "one" },
      { id: 4, name: "Dave", score: 40, group: "one" },
    ])
    await seedPosts([
      { id: 1, authorId: 1, text: "Alice first" },
      { id: 2, authorId: 1, text: "Alice second" },
      { id: 3, authorId: 2, text: "Bob first" },
      { id: 4, authorId: 3, text: "Carol first" },
      { id: 5, authorId: 3, text: "Carol second" },
    ])

    const query = () => db.user
      .select("id", "name", {
        postsCount: q => q.posts.count(),
      })
      .order({ postsCount: "DESC" }, "name", "id")

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([1, 3])
    expect(first.nextCursor).toBeTypeOf("string")
    expect(getIds(second.items)).toEqual([2, 4])
    expect(second.nextCursor).toBeUndefined()
  })

  test("uses prevCursor with a relation column alias order", async () => {
    await seedUsers([
      { id: 1, name: "Alice", score: 10, group: "one" },
      { id: 2, name: "Bob", score: 20, group: "one" },
      { id: 3, name: "Carol", score: 30, group: "one" },
    ])
    await seedPosts([
      { id: 1, authorId: 1, text: "Alice first" },
      { id: 2, authorId: 1, text: "Alice second" },
      { id: 3, authorId: 2, text: "Bob first" },
      { id: 4, authorId: 3, text: "Carol first" },
      { id: 5, authorId: 3, text: "Carol second" },
    ])

    const query = () => db.post
      .select("id", "text", {
        authorName: q => q.author.get("name"),
      })
      .order("authorName", { id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })
    const back = await paginateByCursor(query(), { limit: 2 }, { cursor: second.prevCursor })

    expect(getIds(first.items)).toEqual([2, 1])
    expect(getIds(second.items)).toEqual([3, 5])
    expect(getIds(back.items)).toEqual([2, 1])
    expect(back.prevCursor).toBeUndefined()
    expect(back.nextCursor).toBeTypeOf("string")
  })

  test("uses prevCursor to page backward in display order", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
      { id: 4, name: "d", score: 40, group: "one" },
      { id: 5, name: "e", score: 50, group: "one" },
    ])

    const first = await paginateByCursor(db.user.order({ id: "ASC" }), { limit: 2 })
    const second = await paginateByCursor(db.user.order({ id: "ASC" }), { limit: 2 }, { cursor: first.nextCursor })
    const back = await paginateByCursor(db.user.order({ id: "ASC" }), { limit: 2 }, { cursor: second.prevCursor })

    expect(getIds(first.items)).toEqual([1, 2])
    expect(getIds(second.items)).toEqual([3, 4])
    expect(getIds(back.items)).toEqual([1, 2])
    expect(back.prevCursor).toBeUndefined()
    expect(back.nextCursor).toBeTypeOf("string")
  })

  test("clamps requested limit by config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const page = await paginateByCursor(db.user.order({ id: "ASC" }), { maxLimit: 2 }, { limit: 10 })

    expect(getIds(page.items)).toEqual([1, 2])
    expect(page.limit).toBe(2)
  })
})
