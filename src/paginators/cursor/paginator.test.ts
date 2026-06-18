import { describe, expect, test } from "bun:test"

import { db, getIds, seedPosts, seedUsers } from "#testing"

import { paginateByCursor } from "./paginator"

function keysOf(item: unknown): string[] {
  return Object.keys(item as object)
}

describe("paginateByCursor", () => {
  test("throws for unordered queries", async () => {
    await expect(paginateByCursor(db.user.all(), { limit: 2 })).rejects.toThrow("Query must be ordered.")
  })

  test("auto-injects missing order fields and strips them from result", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    // score is ordered by but not selected; the paginator should auto-inject it.
    const query = () => db.user.select("id", "name").order({ score: "DESC", id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 1 })
    expect(getIds(first.items)).toEqual([3])
    // No temporary cursor columns leak into the result set.
    expect(keysOf(first.items[0]).sort()).toEqual(["id", "name"])
    expect(first.items[0]).not.toHaveProperty("__cursor_0")
    expect(first.nextCursor).toBeTypeOf("string")

    const second = await paginateByCursor(query(), { limit: 1 }, { cursor: first.nextCursor })
    expect(getIds(second.items)).toEqual([2])
    expect(keysOf(second.items[0]).sort()).toEqual(["id", "name"])
    expect(second.prevCursor).toBeTypeOf("string")

    // prevCursor should page back to the first item.
    const back = await paginateByCursor(query(), { limit: 1 }, { cursor: second.prevCursor })
    expect(getIds(back.items)).toEqual([3])
  })

  test("does not inject fields that are already selected", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    // Both order fields are selected, so no __cursor_* columns should appear.
    const query = db.user.select("id", "score").order({ score: "DESC", id: "DESC" })

    const page = await paginateByCursor(query, { limit: 1 })
    expect(getIds(page.items)).toEqual([2])
    expect(keysOf(page.items[0]).sort()).toEqual(["id", "score"])
    expect(page.items[0]).not.toHaveProperty("__cursor_0")
    expect(page.items[0]).not.toHaveProperty("__cursor_1")
  })

  test("does not inject when selecting all columns implicitly", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    // No .select() at all — all main-table columns are returned, including score.
    const query = db.user.order({ score: "DESC", id: "DESC" })

    const page = await paginateByCursor(query, { limit: 1 })
    expect(getIds(page.items)).toEqual([2])
    expect(page.items[0]).not.toHaveProperty("__cursor_0")
  })

  test("respects cursorAliasPrefix config", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    const query = () => db.user.select("id", "name").order({ score: "DESC", id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 1, cursorAliasPrefix: "_xc_" })
    expect(keysOf(first.items[0]).sort()).toEqual(["id", "name"])
    expect(first.items[0]).not.toHaveProperty("_xc_0")
    expect(first.nextCursor).toBeTypeOf("string")

    // Pagination still works end-to-end with the custom prefix.
    const second = await paginateByCursor(
      query(),
      { limit: 1, cursorAliasPrefix: "_xc_" },
      { cursor: first.nextCursor },
    )
    expect(getIds([...first.items, ...second.items])).toEqual([2, 1])
  })

  test("throws a clear error when ordering by a relation that is not selected or joined", async () => {
    await seedUsers([
      { id: 1, name: "Alice", score: 10, group: "one" },
      { id: 2, name: "Bob", score: 20, group: "one" },
    ])
    await seedPosts([
      { id: 1, authorId: 1, text: "Alice first" },
      { id: 2, authorId: 2, text: "Bob first" },
    ])

    // author relation is NOT selected and NOT joined: throw a clear, actionable
    // error rather than letting a cryptic `missing FROM-clause` surface from SQL.
    const query = () =>
      (db.post.select("id", "text") as any).order("author.name", { id: "DESC" }) as any

    await expect(paginateByCursor(query(), { limit: 2 })).rejects.toThrow(
      "Cannot order by \"author.name\" in cursor pagination: relation \"author\" is neither selected nor joined.",
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
