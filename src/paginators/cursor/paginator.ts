import type { PaginationConfig } from "../../limit"
import { getLimit } from "../../limit"
import { getQueryOrderFields } from "../../query"
import type { ListQuery } from "../../types"

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

export type PreparedCursorPagination<T extends ListQuery> = {
  /** Prepared lazy query that fetches one extra row to detect a continuation page. */
  query: T
  /** Finalizes rows returned by the prepared query into a cursor pagination page. */
  finalize(items: Awaited<T>): CursorPaginationPage<T>
}

/** prepareCursorPagination prepares a lazy cursor pagination query and its result finalizer. */
export function prepareCursorPagination<T extends ListQuery>(query: T, config?: CursorPaginationConfig, params?: CursorPaginationParams): PreparedCursorPagination<T> {
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

  // Auto-inject order fields that are missing from the SQL selection as hidden
  // cursor columns. Their values are captured and the aliases are removed before
  // user-defined runtime maps run. Only top-level main-table columns are injected;
  // relation paths must already be selected or joined.
  const prefix = config?.cursorAliasPrefix ?? "__cursor_"
  const cursorColumns = prepareCursorColumns(query, orderFields, prefix)
  query = cursorColumns.apply(query) as T

  // Query 1 extra item to see if we can paginate farther in current direction.
  query = (query as ListQuery).limit(limit + 1) as T

  return {
    query,
    finalize(items) {
      if (!Array.isArray(items)) {
        throw new TypeError("Query must return an array.")
      }
      const hasContinuation = items.length > limit
      // CursorColumns stores values in an array parallel to `items`. Mirror both
      // mutations so item indices still address the matching cursor-value tuple.
      if (hasContinuation) {
        items.splice(limit)
        cursorColumns.truncate(limit)
      }
      if (reverse) {
        items.reverse()
        cursorColumns.reverse()
      }

      function createItemCursor(itemIndex: number, reverse: boolean) {
        return createDirectedCursor(orderFields.map(([field], i) => {
          const value = cursorColumns.valueAt(itemIndex, i)
          // Every order field is captured before runtime transforms. A missing value
          // (undefined) means preparation failed; a legitimate NULL is fine and gets
          // encoded as usual.
          if (value === undefined) {
            throw new Error(
              `Order field "${field}" was not captured from the result row. `
              + "This should not happen after cursor field preparation; "
              + "please report this as a bug.",
            )
          }
          return value === null ? null : String(value)
        }), reverse)
      }

      // Prev cursor:
      // - for initial pagination, there is no prev page
      // - for forward pagination, prev page exists always
      // - for reverse pagination, prev page exists if we have a continuation
      const prevCursor = (parsedCursor && (parsedCursor.reverse === false || hasContinuation))
        ? createItemCursor(0, true)
        : undefined

      // Next cursor:
      // - for reverse pagination, next page exists always
      // - for initial or forward pagination, next page exists if we have a continuation
      const nextCursor = (parsedCursor?.reverse === true || hasContinuation)
        ? createItemCursor(items.length - 1, false)
        : undefined

      return { items, limit, prevCursor, nextCursor }
    },
  }
}

/** paginateByCursor returns one page of results using cursor-based pagination. */
export async function paginateByCursor<T extends ListQuery>(query: T, config?: CursorPaginationConfig, params?: CursorPaginationParams): Promise<CursorPaginationPage<T>> {
  const prepared = prepareCursorPagination(query, config, params)
  return prepared.finalize(await prepared.query)
}
