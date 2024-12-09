import type { SortDir } from "orchid-orm"
import { raw } from "orchid-orm"

import type { ListQuery, PaginationConfig } from "./base"
import { getPageSize } from "./base"
import { createDirectedCursor, getQueryOrderFields, parseDirectedCursor } from "./cursor/utils"

export interface CursorPaginationParams {
  /** Page cursor, as returned by previous call in prevCursor / nextCursor. */
  cursor?: string
  /** Page size. */
  size?: number
}

export type CursorPaginationPage<T extends ListQuery = ListQuery> = {
  items: Awaited<T>
  /** Effective page size. Number of items is guaranteed to be less or equal. */
  size: number
  /** Cursor pointing to previous page. */
  prevCursor?: string
  /** Cursor pointing to next page. */
  nextCursor?: string
}

export async function createCursorPaginator(config?: PaginationConfig) {
  return function paginate<T extends ListQuery>(query: T, params?: CursorPaginationParams) {
    return paginateByCursor(query, config, params)
  }
}

export async function paginateByCursor<T extends ListQuery>(query: T, config?: PaginationConfig, params?: CursorPaginationParams): Promise<CursorPaginationPage<T>> {
  const size = getPageSize(query, config, params)

  const orderFields = getQueryOrderFields(query)

  // poor man validation, TODO improve
  const parsedCursorMaybeValid = params?.cursor ? parseDirectedCursor(params.cursor) : undefined
  const parsedCursor = parsedCursorMaybeValid && parsedCursorMaybeValid.parts.length >= orderFields.length ? parsedCursorMaybeValid : undefined

  const reverse = parsedCursor?.reverse ?? false

  if (reverse) {
    // Reverse parsed order fields + reverse query ordering.
    orderFields.forEach((of) => {
      of[1] = !of[1]
    })
    const orderArg = Object.fromEntries(orderFields.map<[string, SortDir]>(([field, asc]) => [field, asc ? "ASC" : "DESC"]))
    query = query.clear("order").order(orderArg as any)
  }

  if (parsedCursor) {
    // Prepare raw SQL.
    // For example, for (amount asc, id asc) order, that would be:
    // (amount, $id) >= ($amount, id)
    const leftSqlExpr = orderFields.map(([field, asc]) => asc ? field : `$${field}`).join(",")
    const rightSqlExp = orderFields.map(([field, asc]) => asc ? `$${field}` : field).join(",")
    const sqlExpr = `(${leftSqlExpr}) > (${rightSqlExp})`
    const values = Object.fromEntries(orderFields.map(([field], i) => [field, parsedCursor.parts[i]]))
    query = query.where(raw({ raw: sqlExpr, values }))
  }

  // Query 1 extra item to see if we can paginate farther in current direction.
  const items = await query.limit(size + 1)
  if (!Array.isArray(items)) {
    throw new TypeError("Query must return an array.")
  }
  const hasContinuation = items.length > size
  if (hasContinuation) {
    items.splice(size)
  }
  if (reverse) {
    items.reverse()
  }

  function createItemCursor(item: any, reverse: boolean) {
    return createDirectedCursor(orderFields.map(([field]) => {
      // Can add custom serializer here if needed.
      return String(item[field])
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

  return { items, size, prevCursor, nextCursor }
}
