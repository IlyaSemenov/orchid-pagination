import type { Insertable } from "orchid-orm"

import type { PostTable, UserTable } from "./db"
import { db } from "./db"

export async function seedUsers(rows: Array<Insertable<UserTable>>) {
  return await db.user.insertMany(rows).pluck("id")
}

export async function seedPosts(rows: Array<Insertable<PostTable>>) {
  return await db.post.insertMany(rows).pluck("id")
}
