import { afterAll, afterEach, beforeAll, beforeEach } from "bun:test"
import { createBaseTable, testTransaction } from "orchid-orm"
import { orchidORM } from "orchid-orm/postgres-js"

const BaseTable = createBaseTable({ snakeCase: true })

class UserTable extends BaseTable {
  override readonly table = "user"

  override columns = this.setColumns(t => ({
    id: t.serial().primaryKey(),
    name: t.varchar(),
    score: t.integer(),
    group: t.varchar(),
  }))

  relations = {
    posts: this.hasMany(() => PostTable, {
      columns: ["id"],
      references: ["authorId"],
    }),
  }
}

class PostTable extends BaseTable {
  override readonly table = "post"

  override columns = this.setColumns(t => ({
    id: t.serial().primaryKey(),
    authorId: t.integer().foreignKey(() => UserTable, "id"),
    text: t.varchar(),
  }))

  relations = {
    author: this.belongsTo(() => UserTable, {
      columns: ["authorId"],
      references: ["id"],
      required: true,
    }),
  }
}

export const db = orchidORM(
  { databaseURL: import.meta.env.DATABASE_URL },
  {
    post: PostTable,
    user: UserTable,
  },
)

export function useTestDb() {
  beforeAll(async () => {
    await testTransaction.start(db)
    await db.$query`
      create table "user" (id serial not null primary key, name varchar not null, score integer not null, "group" varchar not null);
      create table "post" (id serial not null primary key, author_id integer references "user"(id) not null, text varchar);
    `
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
