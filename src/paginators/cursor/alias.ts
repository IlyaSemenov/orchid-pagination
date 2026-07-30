import type { OrderField } from "../../query"
import { getQuerySelectedKeys } from "../../query"
import type { ListQuery, ResultRow } from "../../types"

/**
 * Keeps cursor data separate from the public result shape.
 *
 * The processing order is significant:
 * 1. SQL selects every order value, injecting `__cursor_N` aliases when needed.
 * 2. A prepended Orchid transform copies those values to a parallel array and
 *    removes injected aliases from the raw rows.
 * 3. User `.map()` transforms run on clean rows and may reshape them freely.
 *
 * Orchid record maps preserve row count and order, so the parallel array stays
 * aligned. Whole-result `.transform()` queries are excluded by `ListQuery`.
 */
export interface CursorColumns {
  /** Adds cursor columns and captures their values before runtime transforms. Returns a new query. */
  apply(query: ListQuery): ListQuery
  /** Reads the i-th order field's captured value for a result row. */
  valueAt(rowIndex: number, fieldIndex: number): unknown
  /** Keeps captured values aligned with a truncated result. */
  truncate(length: number): void
  /** Keeps captured values aligned with a reversed result. */
  reverse(): void
}

/**
 * prepareCursorColumns decides, for each order field, whether it is already
 * present in the result rows or must be auto-injected as a hidden column, and
 * returns a {@link CursorColumns} helper to apply, capture and strip those columns.
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
        // Orchid's RefExpression retains the query that created it. If that query
        // still has a `.map()`, selecting the ref as an alias makes Orchid apply
        // the record map to the scalar alias value in its batch parser. The ref
        // needs SQL metadata from the query, but must not inherit its transforms.
        const sourceQuery = query.clone()
        sourceQuery.q.transform = undefined
        selectObj[alias] = sourceQuery.ref(field)
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
  let capturedValues: unknown[][] = []

  return {
    apply(query) {
      // selectObj holds ref() expressions keyed by alias; its Record type doesn't
      // line up with select()'s SelectAsArg, so cast the argument.
      // Both branches return a clone because q.transform is assigned below.
      const applied = injectedAliases.length ? query.select(selectObj as never) : query.clone()
      // Orchid has no public API for prepending a transform.
      applied.q.transform = [
        (data) => {
          if (Array.isArray(data)) {
            capturedValues = data.map((item) => {
              const row = item as ResultRow
              const values = sources.map((source) => {
                return source.alias !== undefined
                  ? row[source.alias]
                  : getItemValue(row, source.field)
              })
              for (const alias of injectedAliases) {
                delete row[alias]
              }
              return values
            })
          }
          return data
        },
        ...(applied.q.transform ?? []),
      ]
      return applied
    },
    valueAt(rowIndex, fieldIndex) {
      return capturedValues[rowIndex]?.[fieldIndex]
    },
    truncate(length) {
      capturedValues.splice(length)
    },
    reverse() {
      capturedValues.reverse()
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
