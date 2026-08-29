import { afterAll, afterEach, beforeAll, beforeEach } from "bun:test"
import { createBaseTable, testTransaction } from "orchid-orm"
import { orchidORM } from "orchid-orm/postgres-js"

const BaseTable = createBaseTable({ snakeCase: true })

class UserTable extends BaseTable {
  override readonly table = "user"

  override columns = this.setColumns(t => ({
    id: t.serial().primaryKey(),
    name: t.varchar(),
    score: t.integer().nullable(),
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
    text: t.varchar().nullable(),
  }))

  relations = {
    author: this.belongsTo(() => UserTable, {
      columns: ["authorId"],
      references: ["id"],
      required: true,
    }),
  }
}

class TaskTable extends BaseTable {
  override readonly table = "task"

  override columns = this.setColumns(t => ({
    id: t.serial().primaryKey(),
    dueAt: t.timestamp().nullable(),
  }))
}

class CursorTypeTable extends BaseTable {
  override readonly table = "cursor_type"

  override columns = this.setColumns(t => ({
    id: t.serial().primaryKey(),
    uuid: t.uuid(),
    timestamp: t.timestampNoTZ(),
    timestamptz: t.timestamp(),
    date: t.date(),
    numeric: t.decimal(),
    integer: t.integer(),
  }))
}

export const db = orchidORM(
  { databaseURL: import.meta.env.DATABASE_URL },
  {
    cursorType: CursorTypeTable,
    post: PostTable,
    task: TaskTable,
    user: UserTable,
  },
)

export function useTestDb() {
  beforeAll(async () => {
    await testTransaction.start(db)
    await db.$query`
      create table "user" (id serial not null primary key, name varchar not null, score integer, "group" varchar not null);
      create table "post" (id serial not null primary key, author_id integer references "user"(id) not null, text varchar);
      create table "task" (id serial not null primary key, due_at timestamp);
      create table cursor_type (
        id serial not null primary key,
        uuid uuid not null,
        timestamp timestamp not null,
        timestamptz timestamptz not null,
        date date not null,
        numeric numeric not null,
        integer integer not null
      );
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
