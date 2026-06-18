import { getLimit, type PaginationConfig } from "../../limit"
import { getQueryOrderFields } from "../../query"
import type { ListQuery, SortDir } from "../../types"

import { createDirectedCursor, parseDirectedCursor } from "./cursor"
import { buildCursorWhere } from "./where"

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
  if (!orderFields.length) {
    throw new Error("Query must be ordered.")
  }

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
    // query.where doesn't like low-level RawSql objects, cast to any to silence
    query = query.where(buildCursorWhere(query, orderFields, parsedCursor.parts) as any)
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
      const value = getItemValue(item, field)
      // A missing order field (undefined) means it wasn't selected; encoding it would
      // produce a broken cursor that later fails deep inside the database. A legitimate
      // NULL value is fine and gets encoded as usual.
      if (value === undefined) {
        throw new Error(`Order field "${field}" is missing from the result — cursor pagination requires every order field to be selected.`)
      }
      // Can add custom serializer here if needed.
      return String(value)
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
