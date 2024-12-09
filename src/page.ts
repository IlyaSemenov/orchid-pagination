import { getPageSize, type ListQuery, type PaginationConfig } from "./base"

export interface PagePaginationParams {
  /** Page, 1-based. */
  page?: number
  /** Page size. */
  size?: number
}

export type PagePaginationPage<T extends ListQuery = ListQuery> = {
  items: Awaited<T>
  /** Effective page number. */
  page: number
  /** Effective page size. Number of items is guaranteed to be less or equal. */
  size: number
  /** Offset of the first item, 1-based. */
  offset: number
  /** Prev page numberm (if exists). */
  prevPage?: number
  /** Next page number (if exists). */
  nextPage?: number
}

export function createPagePaginator(config?: PaginationConfig) {
  return function paginate<T extends ListQuery>(query: T, params?: PagePaginationParams) {
    return paginateByPage(query, config, params)
  }
}

export async function paginateByPage<T extends ListQuery>(query: T, config?: PaginationConfig, params?: PagePaginationParams): Promise<PagePaginationPage<T>> {
  const size = getPageSize(query, config, params)

  const page = Math.max(1, params?.page ?? 1)
  const offset = (page - 1) * size

  const items = await query.offset(offset).limit(size + 1)
  const hasContinuation = items.length > size
  if (hasContinuation) {
    items.splice(size)
  }

  const prevPage = page > 1 ? page - 1 : undefined
  const nextPage = hasContinuation ? page + 1 : undefined

  return { items, page, size, offset, prevPage, nextPage }
}
