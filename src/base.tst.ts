import process from "node:process"

import { createBaseTable, orchidORM } from "orchid-orm"
import { expect, test } from "tstyche"

import type { ListQuery } from "./base"

const BaseTable = createBaseTable()

class UserTable extends BaseTable {
  override readonly table = "user"

  override columns = this.setColumns(t => ({
    id: t.serial().primaryKey(),
    name: t.varchar().unique(),
  }))
}

const db = orchidORM(
  { databaseURL: process.env.DATABASE_URL, log: true },
  {
    user: UserTable,
  },
)

async function getQueryResult<T extends ListQuery>(query: T) {
  return await query
}

test("ListQuery generic result", () => {
  expect<Awaited<ListQuery>>().type.toBe<unknown[]>()
})

test("ListQuery type inference", async () => {
  const users = await getQueryResult(db.user.all())
  expect<typeof users>().type.toBe<Array<{ id: number, name: string }>>()
})
