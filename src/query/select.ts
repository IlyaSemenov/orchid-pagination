import type { ListQuery } from "../types"

export interface QuerySelectedKeys {
  /**
   * True when the query selects all columns of the main table (no `.select(...)` or a `"*"` item).
   * Does NOT cover joined/relation columns.
   */
  all: boolean
  /** Set of result-row aliases produced by the SELECT list. */
  keys: Set<string>
}

/**
 * getQuerySelectedKeys inspects the query's SELECT list.
 *
 * For a string item `"col"` the alias is `"col"`, for `"table.col"` it is
 * `"col"`, for a `{ selectAs: {...} }` item they are the object keys.
 */
export function getQuerySelectedKeys(query: ListQuery): QuerySelectedKeys {
  const select = query.q.select
  let all = false
  const keys = new Set<string>()

  if (!select || select.length === 0) {
    all = true
    return { all, keys }
  }

  for (const item of select) {
    if (typeof item === "string") {
      if (item === "*") {
        all = true
        continue
      }
      const dotIndex = item.indexOf(".")
      keys.add(dotIndex === -1 ? item : item.slice(dotIndex + 1))
    } else if (item && typeof item === "object" && "selectAs" in item) {
      const selectAs = (item as { selectAs: Record<string, unknown> }).selectAs
      for (const key in selectAs) {
        keys.add(key)
      }
    }
  }

  return { all, keys }
}
