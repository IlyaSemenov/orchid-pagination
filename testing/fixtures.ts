import { db } from "./db"

type UserSeed = {
  id: number
  name: string
  score: number
  group: string
}

type PostSeed = {
  id: number
  authorId: number
  text: string
}

export async function seedUsers(rows: UserSeed[]) {
  return await db.user.insertMany(rows).pluck("id")
}

export async function seedPosts(rows: PostSeed[]) {
  return await db.post.insertMany(rows).pluck("id")
}
