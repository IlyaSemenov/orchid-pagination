import { expect, test } from "bun:test"
import { paginateByCursor } from "orchid-pagination"

import { db, seedPosts, seedUsers } from "#testing"

test.each([
  { direction: "ASC", ids: [3, 2, 1, 5, 4] },
  { direction: "DESC", ids: [5, 4, 1, 3, 2] },
] as const)("paginates a joined computed field with bound SQL values ($direction)", async ({ direction, ids }) => {
  await seedUsers([
    { id: 1, name: "Bob", score: 10, group: "one" },
    { id: 2, name: "Alice", score: 20, group: "one" },
    { id: 3, name: "ALICE", score: 30, group: "one" },
    { id: 4, name: "hidden", score: 40, group: "one" },
    { id: 5, name: "HIDDEN", score: 50, group: "one" },
  ])
  await seedPosts([
    ...[1, 2, 3, 4, 5].map(id => ({ id, authorId: id, text: "visible" })),
    { id: 6, authorId: 1, text: "excluded" },
  ])

  const query = () => db.post
    .join(q => q.author.as("joinedAuthor"))
    .where({ text: "visible" })
    .select("id")
    .order({ "joinedAuthor.nameLabel": direction, "id": "DESC" })

  let page = await paginateByCursor(query(), { limit: 1 })
  expect(page.items).toEqual([{ id: ids[0] }])
  expect(page.prevCursor).toBeUndefined()

  for (const id of ids.slice(1)) {
    expect(page.nextCursor).toBeTypeOf("string")
    page = await paginateByCursor(query(), { limit: 1 }, { cursor: page.nextCursor })
    expect(page.items).toEqual([{ id }])
  }
  expect(page.nextCursor).toBeUndefined()

  for (const id of ids.slice(0, -1).reverse()) {
    expect(page.prevCursor).toBeTypeOf("string")
    page = await paginateByCursor(query(), { limit: 1 }, { cursor: page.prevCursor })
    expect(page.items).toEqual([{ id }])
  }
  expect(page.prevCursor).toBeUndefined()
})
