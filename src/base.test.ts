import { expectTypeOf, test } from "bun:test"

import { db } from "#testing"

import type { ListQuery } from "./base"

async function getQueryResult<T extends ListQuery>(query: T) {
  return await query
}

test("ListQuery generic result", () => {
  expectTypeOf<Awaited<ListQuery>>().toEqualTypeOf<unknown[]>()
})

test("ListQuery type inference", async () => {
  const users = await getQueryResult(db.user.all())
  expectTypeOf<typeof users>().toEqualTypeOf<Array<{ id: number, name: string }>>()
  void users
})
