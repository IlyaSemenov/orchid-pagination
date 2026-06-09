import { getLimit, type PaginationConfig } from "../../limit"
import type { ListQuery, SortDir } from "../../types"

import { createDirectedCursor, parseDirectedCursor } from "./cursor"
import { getQueryOrderFields } from "./order"

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

/** paginateByCursor returns one page of results using cursor-based pagination. */
export async function paginateByCursor<T extends ListQuery>(query: T, config?: PaginationConfig, params?: CursorPaginationParams): Promise<CursorPaginationPage<T>> {
  const limit = getLimit(query, config, params)

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
    // For example, for (amount ASC, id DESC) ordering, that would be:
    // (amount, $id) >= ($amount, id)
    const leftRawSql = orderFields.map(([field, asc], i) => asc ? query.ref(field).toSQL() : `$value${i}`).join(",")
    const rightRawSql = orderFields.map(([field, asc], i) => !asc ? query.ref(field).toSQL() : `$value${i}`).join(",")
    const rawSql = `(${leftRawSql}) > (${rightRawSql})`
    const rawSqlValues = Object.fromEntries(
      orderFields.map((_field, i) => [`value${i}`, parsedCursor.parts[i]]),
    )
    const sqlExpr = query.qb.sql({ raw: rawSql, values: rawSqlValues })
    // query.where doesn't like low-level RawSql objects, cast to any to silence
    query = query.where(sqlExpr as any)
  }

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

  function createItemCursor(item: any, reverse: boolean) {
    return createDirectedCursor(orderFields.map(([field]) => {
      // Can add custom serializer here if needed.
      return String(getItemValue(item, field))
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

  return { items, limit, prevCursor, nextCursor }
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
