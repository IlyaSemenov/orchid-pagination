import type { Query } from "orchid-orm"

export type ListQuery = Query & {
  returnType: undefined | "all"
}

export type SortDir = "ASC" | "DESC"
