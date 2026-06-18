import { getQuerySelectedKeys, type OrderField } from "../../query"
import type { ListQuery, ResultRow } from "../../types"

/**
 * CursorColumns manages the hidden columns used to read order-field values back
 * from result rows.
 *
 * Order fields that aren't present in the query's SELECT are auto-injected as
 * hidden columns (`__cursor_0`, `__cursor_1`, ...) so cursors can be built from
 * the result rows, then stripped from the returned items.
 */
export interface CursorColumns {
  /** Adds the injected cursor columns to the query's SELECT. Returns a new query. */
  apply(query: ListQuery): ListQuery
  /** Reads the i-th order field's value from a result row, via its injected alias or by path. */
  valueOf(item: ResultRow, fieldIndex: number): unknown
  /** Removes the injected cursor columns from result rows in place. */
  strip(items: ResultRow[]): void
}

/**
 * prepareCursorColumns decides, for each order field, whether it is already
 * present in the result rows or must be auto-injected as a hidden column, and
 * returns a {@link CursorColumns} helper to apply, read and strip those columns.
 *
 * Only top-level main-table columns are auto-injected; relation paths (e.g.
 * `author.name`) require the relation to already be selected or joined, and
 * fail with a clear error otherwise.
 */
export function prepareCursorColumns(query: ListQuery, orderFields: OrderField[], prefix: string): CursorColumns {
  const { all: selectAll, keys: selectedKeys } = getQuerySelectedKeys(query)
  const joinedShapes = (query.q.joinedShapes && Object.keys(query.q.joinedShapes)) || []

  // For each order field, resolve where its value lives in the result row: an
  // existing selected column (`alias: undefined`, read by path), or an injected
  // `__cursor_N` column. A relation path that is neither selected nor joined is
  // a hard error.
  const sources: { field: string, alias?: string }[] = []
  const selectObj: Record<string, unknown> = {}
  let cursorIdx = 0
  for (const [field] of orderFields) {
    switch (classifyOrderField(field, selectAll, selectedKeys, joinedShapes)) {
      case "present":
        sources.push({ field })
        break
      case "inject": {
        const alias = `${prefix}${cursorIdx++}`
        sources.push({ field, alias })
        selectObj[alias] = query.ref(field)
        break
      }
      case "error": {
        const rel = field.slice(0, field.indexOf("."))
        throw new Error(
          `Cannot order by "${field}" in cursor pagination: relation "${rel}" is neither selected nor joined. `
          + `Select it (e.g. .select({ ${rel}: q => q.${rel}.select(...) })) or join it manually before ordering.`,
        )
      }
    }
  }

  const injectedAliases = sources.map(s => s.alias).filter((a): a is string => a !== undefined)

  return {
    apply(query) {
      // selectObj holds ref() expressions keyed by alias; its Record type doesn't
      // line up with select()'s SelectAsArg, so cast the argument.
      return injectedAliases.length ? query.select(selectObj as never) : query
    },
    valueOf(item, fieldIndex) {
      const source = sources[fieldIndex]!
      return source.alias !== undefined ? item[source.alias] : getItemValue(item, source.field)
    },
    strip(items) {
      if (!injectedAliases.length) {
        return
      }
      for (const item of items) {
        for (const alias of injectedAliases) {
          delete item[alias]
        }
      }
    },
  }
}

type OrderFieldSource = "present" | "inject" | "error"

/** classifyOrderField determines how an order field's value is obtained from a result row. */
function classifyOrderField(field: string, selectAll: boolean, selectedKeys: Set<string>, joinedShapes: string[]): OrderFieldSource {
  const dotIndex = field.indexOf(".")
  if (dotIndex === -1) {
    return selectAll || selectedKeys.has(field) ? "present" : "inject"
  }

  // Relation path: covered only when the relation itself is selected.
  const rel = field.slice(0, dotIndex)
  if (selectedKeys.has(field) || selectedKeys.has(rel)) {
    return "present"
  }
  // Auto-injecting a `ref("author.name")` requires an existing join; without one
  // it would surface a cryptic `missing FROM-clause entry for table "..."`.
  return joinedShapes.includes(rel) ? "inject" : "error"
}

/** getItemValue returns an item's field value, resolving dot-notation paths against nested objects. */
function getItemValue(item: unknown, field: string): unknown {
  if (!field.includes(".")) {
    return (item as Record<string, unknown>)[field]
  }

  return field.split(".").reduce<unknown>((obj, key) => {
    return obj == null ? undefined : (obj as Record<string, unknown>)[key]
  }, item)
}
