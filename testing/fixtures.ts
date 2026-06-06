import { db } from "./db"

type UserSeed = {
  id: number
  name: string
  score: number
  group: string
}

export async function seedUsers(rows: UserSeed[]) {
  return await db.user.insertMany(rows).pluck("id")
}
