import { describe, expect, test } from "bun:test"

import { db, getIds, seedPosts, seedUsers } from "#testing"

import { paginateByCursor, prepareCursorPagination } from "./paginator"

function keysOf(item: unknown): string[] {
  return Object.keys(item as object)
}

describe("prepareCursorPagination", () => {
  test("executes a second lazy page and finalizes it through an Orchid transform", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: 30, group: "one" },
    ])

    const firstPrepared = prepareCursorPagination(db.user.order({ id: "ASC" }), { limit: 2 })
    const first = firstPrepared.finalize(await firstPrepared.query)
    const secondPrepared = prepareCursorPagination(
      db.user.order({ id: "ASC" }),
      { limit: 2 },
      { cursor: first.nextCursor },
    )
    const second = await secondPrepared.query.transform(secondPrepared.finalize)

    expect(getIds(first.items)).toEqual([1, 2])
    expect(getIds(second.items)).toEqual([3])
    expect(second.prevCursor).toBeTypeOf("string")
    expect(second.nextCursor).toBeUndefined()
  })
})

describe("paginateByCursor", () => {
  test("does not shift timestamp without time zone cursor bindings", async () => {
    const originalTimeZone = process.env.TZ

    try {
      await db.$query`
        INSERT INTO cursor_type (id, uuid, "timestamp", timestamptz, date, numeric, integer)
        VALUES
          (1, '00000000-0000-0000-0000-000000000001', TIMESTAMP '2020-01-01 00:00:00', TIMESTAMPTZ '2020-01-01 00:00:00+00', DATE '2020-01-01', 1, 1),
          (2, '00000000-0000-0000-0000-000000000002', TIMESTAMP '2020-01-01 01:00:00', TIMESTAMPTZ '2020-01-02 00:00:00+00', DATE '2020-01-02', 2, 2)
      `

      for (const timeZone of ["America/New_York", "UTC", "Asia/Bangkok"]) {
        process.env.TZ = timeZone

        const query = () => db.cursorType.order({ timestamp: "ASC", id: "ASC" })
        const first = await paginateByCursor(query(), { limit: 1 })
        const second = await paginateByCursor(query(), { limit: 1 }, { cursor: first.nextCursor })

        expect(getIds(first.items)).toEqual([1])
        expect(getIds(second.items)).toEqual([2])
      }
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTimeZone
      }
    }
  })

  test("paginates uuid, date/time, and numeric order columns", async () => {
    await db.cursorType.insertMany([
      {
        id: 1,
        uuid: "00000000-0000-0000-0000-000000000001",
        timestamp: new Date("2020-01-01T00:00:00.000Z"),
        timestamptz: new Date("2020-01-01T00:00:00.000Z"),
        date: new Date("2020-01-01T00:00:00.000Z"),
        numeric: "1.25",
        integer: 10,
      },
      {
        id: 2,
        uuid: "00000000-0000-0000-0000-000000000002",
        timestamp: new Date("2020-01-02T00:00:00.000Z"),
        timestamptz: new Date("2020-01-02T00:00:00.000Z"),
        date: new Date("2020-01-02T00:00:00.000Z"),
        numeric: "2.5",
        integer: 20,
      },
    ])

    for (const field of ["uuid", "timestamp", "timestamptz", "date", "numeric", "integer"] as const) {
      const order = { [field]: "ASC", id: "ASC" } as const
      const first = await paginateByCursor(db.cursorType.order(order), { limit: 1 })
      const second = await paginateByCursor(db.cursorType.order(order), { limit: 1 }, { cursor: first.nextCursor })

      expect(getIds(first.items)).toEqual([1])
      expect(getIds(second.items)).toEqual([2])
    }
  })

  test("throws for unordered queries", async () => {
    await expect(paginateByCursor(db.user.all(), { limit: 2 })).rejects.toThrow("Query must be ordered.")
  })

  test("treats an invalid cursor as the first page", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
    ])

    const page = await paginateByCursor(
      db.user.order({ id: "ASC" }),
      { limit: 1 },
      { cursor: "not-json" },
    )

    expect(getIds(page.items)).toEqual([1])
    expect(page.prevCursor).toBeUndefined()
    expect(page.nextCursor).toBeTypeOf("string")
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

  test("paginates forward and backward across a nulls-last boundary", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 10, group: "one" },
      { id: 3, name: "c", score: 20, group: "one" },
      { id: 4, name: "d", score: null, group: "one" },
      { id: 5, name: "e", score: null, group: "one" },
    ])

    const query = () => db.user.order({ score: "ASC", id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })
    const third = await paginateByCursor(query(), { limit: 2 }, { cursor: second.nextCursor })
    const backToSecond = await paginateByCursor(query(), { limit: 2 }, { cursor: third.prevCursor })
    const backToFirst = await paginateByCursor(query(), { limit: 2 }, { cursor: backToSecond.prevCursor })

    expect(getIds(first.items)).toEqual([2, 1])
    expect(getIds(second.items)).toEqual([3, 5])
    expect(getIds(third.items)).toEqual([4])
    expect(getIds(backToSecond.items)).toEqual([3, 5])
    expect(getIds(backToFirst.items)).toEqual([2, 1])
  })

  test("keeps cursor values hidden by a runtime map", async () => {
    const overdue = new Date("2020-01-01T00:00:00.000Z")
    await db.task.insertMany([
      { id: 1, dueAt: overdue },
      { id: 2, dueAt: new Date("2030-01-01T00:00:00.000Z") },
      { id: 3, dueAt: null },
      { id: 4, dueAt: overdue },
      { id: 5, dueAt: null },
    ])

    const query = () => db.task
      .select("id", "dueAt")
      .map(({ dueAt, ...task }) => ({
        ...task,
        meta: { dueAt },
      }))
      .order({ dueAt: "ASC", id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })
    const third = await paginateByCursor(query(), { limit: 2 }, { cursor: second.nextCursor })
    const back = await paginateByCursor(query(), { limit: 2 }, { cursor: third.prevCursor })
    const items = [...first.items, ...second.items, ...third.items]

    expect(first.nextCursor).toBeTypeOf("string")
    expect(getIds(items)).toEqual([4, 1, 2, 5, 3])
    expect(new Set(getIds(items)).size).toBe(items.length)
    expect(second.items[1]?.meta.dueAt).toBeNull()
    expect(getIds(back.items)).toEqual(getIds(second.items))
    for (const item of [...items, ...back.items]) {
      expect(item).not.toHaveProperty("dueAt")
      expect(Object.keys(item).some(key => key.startsWith("__cursor_"))).toBeFalse()
    }
  })

  test("hides auto-injected cursor columns before a runtime map", async () => {
    await db.task.insertMany([
      { id: 1, dueAt: new Date("2020-01-01T00:00:00.000Z") },
      { id: 2, dueAt: new Date("2030-01-01T00:00:00.000Z") },
      { id: 3, dueAt: null },
    ])

    const query = () => db.task
      .select("id")
      .map(task => ({
        id: task.id,
        raw: { ...task },
      }))
      .order({ dueAt: "ASC", id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 1 })
    const second = await paginateByCursor(query(), { limit: 1 }, { cursor: first.nextCursor })
    const third = await paginateByCursor(query(), { limit: 1 }, { cursor: second.nextCursor })
    const items = [...first.items, ...second.items, ...third.items]

    expect(getIds(items)).toEqual([1, 2, 3])
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["id", "raw"])
      expect(Object.keys(item.raw)).toEqual(["id"])
    }
  })

  test("paginates from nulls-first values to non-null values", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: null, group: "one" },
      { id: 4, name: "d", score: null, group: "one" },
    ])

    const query = () => db.user.order({ score: "DESC", id: "ASC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([3, 4])
    expect(getIds(second.items)).toEqual([2, 1])
  })

  test("preserves explicit null ordering when paginating backward", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: null, group: "one" },
      { id: 4, name: "d", score: null, group: "one" },
    ])

    const query = () => db.user.order({ score: "ASC NULLS FIRST", id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })
    const back = await paginateByCursor(query(), { limit: 2 }, { cursor: second.prevCursor })

    expect(getIds(first.items)).toEqual([4, 3])
    expect(getIds(second.items)).toEqual([1, 2])
    expect(getIds(back.items)).toEqual([4, 3])
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

  test("paginates forward ordered by a selected-column alias", async () => {
    await seedUsers([
      { id: 1, name: "a", score: 10, group: "one" },
      { id: 2, name: "b", score: 20, group: "one" },
      { id: 3, name: "c", score: null, group: "one" },
    ])

    const query = () => db.user
      .select("id", { s: "score" })
      .order({ s: "ASC", id: "DESC" })

    const first = await paginateByCursor(query(), { limit: 2 })
    const second = await paginateByCursor(query(), { limit: 2 }, { cursor: first.nextCursor })

    expect(getIds(first.items)).toEqual([1, 2])
    expect(getIds(second.items)).toEqual([3])
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
