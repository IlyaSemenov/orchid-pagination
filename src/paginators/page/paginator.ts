import { getLimit, type PaginationConfig } from "../../limit"
import type { ListQuery } from "../../types"

export type PagePaginationConfig = PaginationConfig & {
  /**
   * When true, runs a COUNT(*) query and returns `totalItems` / `totalPages` in the result.
   * Requested pages beyond the last are not clamped unless `clampPage` is true.
   */
  total?: boolean
}

export type PagePaginationConfigWithTotal = PagePaginationConfig & {
  total: true
  /** When true, requested pages beyond the last are clamped to the last page. */
  clampPage?: boolean
}

export interface PagePaginationParams {
  /** Page number, 1-based. */
  page?: number
  /** Page size. */
  limit?: number
}

export type PagePaginationPage<T extends ListQuery = ListQuery> = {
  items: Awaited<T>
  /** Effective page number, 1-based. */
  page: number
  /** Effective page size. Number of items is guaranteed to be less than or equal to this value. */
  limit: number
  /** Offset passed to the query, 0-based. */
  offset: number
  /** Previous page number, if it exists. */
  prevPage?: number
  /** Next page number, if it exists. */
  nextPage?: number
}

export type PagePaginationTotal = {
  /** Total number of items across all pages. */
  totalItems: number
  /** Total number of pages. */
  totalPages: number
}

export type PagePaginationPageWithTotal<T extends ListQuery = ListQuery> = PagePaginationPage<T> & PagePaginationTotal

/** paginateByPage returns one page of results using offset-based pagination. */
export async function paginateByPage<T extends ListQuery>(
  query: T,
  config: PagePaginationConfigWithTotal,
  params?: PagePaginationParams,
): Promise<PagePaginationPageWithTotal<T>>
export async function paginateByPage<T extends ListQuery>(
  query: T,
  config?: PagePaginationConfig,
  params?: PagePaginationParams,
): Promise<PagePaginationPage<T>>
export async function paginateByPage<T extends ListQuery>(
  query: T,
  config?: PagePaginationConfig | PagePaginationConfigWithTotal,
  params?: PagePaginationParams,
) {
  const limit = getLimit(query, config, params)

  let page = Math.max(1, params?.page ?? 1)

  let total: PagePaginationTotal | undefined
  if (config?.total) {
    const totalItems = await (query as ListQuery).clear("select", "order").count() as number
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))
    total = { totalItems, totalPages }
    if ((config as PagePaginationConfigWithTotal).clampPage) {
      page = Math.min(page, totalPages)
    }
  }

  const offset = (page - 1) * limit

  // When total is known, we can request exactly `limit` items;
  // otherwise, request limit + 1 to detect continuation.
  const items = await (query as ListQuery)
    .offset(offset)
    .limit(total ? limit : limit + 1) as Awaited<T>
  if (!Array.isArray(items)) {
    throw new TypeError("Query must return an array.")
  }

  const hasContinuation = total ? page < total.totalPages : items.length > limit
  if (items.length > limit) {
    items.splice(limit)
  }

  const prevPage = page > 1 ? page - 1 : undefined
  const nextPage = hasContinuation ? page + 1 : undefined

  const result: PagePaginationPage<T> = { items, page, limit, offset, prevPage, nextPage }

  if (total) {
    return { ...result, ...total } as PagePaginationPageWithTotal<T>
  }

  return result
}
