import type { Query } from "orchid-orm"

export type ListQuery = Query & {
  returnType: undefined | "all"
}

export type SortDir =
  | "ASC"
  | "DESC"
  | "ASC NULLS FIRST"
  | "ASC NULLS LAST"
  | "DESC NULLS FIRST"
  | "DESC NULLS LAST"

/** A single result row returned by a list query, keyed by selected alias. */
export type ResultRow = Record<string, unknown>
