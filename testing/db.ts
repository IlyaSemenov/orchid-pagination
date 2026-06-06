import { afterAll, afterEach, beforeAll, beforeEach } from "bun:test"
import { createBaseTable, testTransaction } from "orchid-orm"
import { orchidORM } from "orchid-orm/postgres-js"

const BaseTable = createBaseTable()

class UserTable extends BaseTable {
  override readonly table = "user"

  override columns = this.setColumns(t => ({
    id: t.serial().primaryKey(),
    name: t.varchar(),
    score: t.integer(),
    group: t.varchar(),
  }))
}

export const db = orchidORM(
  { databaseURL: import.meta.env.DATABASE_URL },
  {
    user: UserTable,
  },
)

export function useTestDb() {
  beforeAll(async () => {
    await testTransaction.start(db)
    await db.$query`create table "user" (id serial not null primary key, name varchar not null, score integer not null, "group" varchar not null)`
  })

  beforeEach(async () => {
    await testTransaction.start(db)
  })

  afterEach(async () => {
    await testTransaction.rollback(db)
  })

  afterAll(async () => {
    await testTransaction.close(db)
  })
}
