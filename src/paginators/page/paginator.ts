import { getLimit, type PaginationConfig } from "../../limit"
import type { ListQuery } from "../../types"

export interface PagePaginationParams {
  /** Page, 1-based. */
  page?: number
  /** Limit. */
  limit?: number
}

export type PagePaginationPage<T extends ListQuery = ListQuery> = {
  items: Awaited<T>
  /** Effective page number. */
  page: number
  /** Effective limit. Number of items is guaranteed to be less or equal. */
  limit: number
  /** Offset of the first item, 1-based. */
  offset: number
  /** Prev page number (if exists). */
  prevPage?: number
  /** Next page number (if exists). */
  nextPage?: number
}

/** paginateByPage returns one page of results using offset-based pagination. */
export async function paginateByPage<T extends ListQuery>(query: T, config?: PaginationConfig, params?: PagePaginationParams): Promise<PagePaginationPage<T>> {
  const limit = getLimit(query, config, params)

  const page = Math.max(1, params?.page ?? 1)
  const offset = (page - 1) * limit

  const items = await (query as ListQuery).offset(offset).limit(limit + 1) as Awaited<T>
  if (!Array.isArray(items)) {
    throw new TypeError("Query must return an array.")
  }
  const hasContinuation = items.length > limit
  if (hasContinuation) {
    items.splice(limit)
  }

  const prevPage = page > 1 ? page - 1 : undefined
  const nextPage = hasContinuation ? page + 1 : undefined

  return { items, page, limit, offset, prevPage, nextPage }
}
