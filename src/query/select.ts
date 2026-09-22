import type { ListQuery } from "../types"

/**
 * Returns the result-row keys produced by the query's SELECT list.
 * Implicit selection and `"*"` expand to main-table columns that do not require explicit selection.
 *
 * For a string item `"col"` the alias is `"col"`, for `"table.col"` it is
 * `"col"`, for a `{ selectAs: {...} }` item they are the object keys.
 */
export function getQuerySelectedKeys(query: ListQuery): Set<string> {
  const select = query.q.select
  const keys = new Set<string>()

  if (!select?.length || select.includes("*")) {
    const shape = query.q.selectAllShape as typeof query.q.selectShape
    for (const key in shape) {
      if (!shape[key]!.data.explicitSelect) {
        keys.add(key)
      }
    }
  }

  for (const item of select ?? []) {
    if (typeof item === "string") {
      if (item === "*") {
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

  return keys
}
