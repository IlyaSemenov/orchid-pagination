import type { PaginationConfig } from "../../limit"
import { getLimit } from "../../limit"
import { getQueryOrderFields } from "../../query"
import type { ListQuery, ResultRow } from "../../types"

import { prepareCursorColumns } from "./alias"
import { createDirectedCursor, parseDirectedCursor } from "./cursor"
import { applyCursorOrder, orderFieldNeedsNullRank } from "./order"
import { buildCursorWhere } from "./where"

export interface CursorPaginationConfig extends PaginationConfig {
  /** Prefix for auto-injected cursor columns. Defaults to `__cursor_`. */
  cursorAliasPrefix?: string
}

export interface CursorPaginationParams {
  /** Cursor returned as prevCursor or nextCursor by a previous call. */
  cursor?: string
  /** Page size. */
  limit?: number
}

export type CursorPaginationPage<T extends ListQuery = ListQuery> = {
  items: Awaited<T>
  /** Effective page size. Number of items is guaranteed to be less than or equal to this value. */
  limit: number
  /** Cursor for fetching the previous page, if it exists. */
  prevCursor?: string
  /** Cursor for fetching the next page, if it exists. */
  nextCursor?: string
}

/**
 * paginateByCursor returns one page of results using cursor-based pagination.
 *
 * Order fields that are missing from the query's SELECT are auto-injected as
 * hidden columns (`__cursor_0`, `__cursor_1`, ...) and stripped from the
 * returned rows. Only top-level main-table columns are auto-injected;
 * relation paths (e.g. `author.name`) require the relation to already be
 * selected/joined.
 */
export async function paginateByCursor<T extends ListQuery>(query: T, config?: CursorPaginationConfig, params?: CursorPaginationParams): Promise<CursorPaginationPage<T>> {
  const limit = getLimit(query, config, params)

  const orderFields = getQueryOrderFields(query)
  if (!orderFields.length) {
    throw new Error("Query must be ordered.")
  }

  // poor man validation, TODO improve
  const parsedCursorMaybeValid = params?.cursor ? parseDirectedCursor(params.cursor) : undefined
  const parsedCursor = parsedCursorMaybeValid?.parts.length === orderFields.length ? parsedCursorMaybeValid : undefined

  const reverse = parsedCursor?.reverse ?? false

  const queryOrderFields = reverse
    ? orderFields.map<typeof orderFields[number]>(([field, asc, nulls]) => [
        field,
        !asc,
        nulls === "FIRST" ? "LAST" : "FIRST",
      ])
    : orderFields

  if (reverse || queryOrderFields.some(([field]) => orderFieldNeedsNullRank(query, field))) {
    query = applyCursorOrder(query, queryOrderFields) as T
  }

  if (parsedCursor) {
    // query.where doesn't like low-level RawSql objects, cast to silence
    query = query.where(buildCursorWhere(query, orderFields, parsedCursor.parts, reverse) as never)
  }

  // Auto-inject order fields that are missing from the result rows as hidden
  // cursor columns, so we can build cursors from the rows; they are stripped
  // from the returned items after cursors are computed.
  const prefix = config?.cursorAliasPrefix ?? "__cursor_"
  const cursorColumns = prepareCursorColumns(query, orderFields, prefix)
  query = cursorColumns.apply(query) as T

  // Query 1 extra item to see if we can paginate farther in current direction.
  const items = await (query as ListQuery).limit(limit + 1) as Awaited<T>
  if (!Array.isArray(items)) {
    throw new TypeError("Query must return an array.")
  }
  const hasContinuation = items.length > limit
  if (hasContinuation) {
    items.splice(limit)
  }
  if (reverse) {
    items.reverse()
  }

  function createItemCursor(item: ResultRow, reverse: boolean) {
    return createDirectedCursor(orderFields.map(([field], i) => {
      const value = cursorColumns.valueOf(item, i)
      // After auto-injection every order field should be present. A missing value
      // (undefined) means it leaked through; a legitimate NULL is fine and gets
      // encoded as usual.
      if (value === undefined) {
        throw new Error(
          `Order field "${field}" is missing from the result row. `
          + "This should not happen after cursor field auto-injection; "
          + "please report this as a bug.",
        )
      }
      // Can add custom serializer here if needed.
      return value === null ? null : String(value)
    }), reverse)
  }

  // Prev cursor:
  // - for initial pagination, there is no prev page
  // - for forward pagination, prev page exists always
  // - for reverse pagination, prev page exists if we have a continuation
  const prevCursor = (parsedCursor && (parsedCursor.reverse === false || hasContinuation))
    ? createItemCursor(items[0], true)
    : undefined

  // Next cursor:
  // - for reverse pagination, next page exists always
  // - for initial or forward pagination, next page exists if we have a continuation
  const nextCursor = (parsedCursor?.reverse === true || hasContinuation)
    ? createItemCursor(items.at(-1), false)
    : undefined

  // Strip auto-injected cursor columns from the returned items.
  cursorColumns.strip(items)

  return { items, limit, prevCursor, nextCursor }
}
