import type { Query, QueryThen, SelectQueryData } from "orchid-orm"

export interface ListQuery extends Query {
  then: QueryThen<unknown[]>
}

export interface PaginationConfig {
  /** Default page size. If not set, `maxPageSize` is used. */
  pageSize?: number
  /** Max page size allowed to be passed in params. If not set, `pageSize` is used. */
  maxPageSize?: number
}

export interface PaginationParams {
  /** Requested page size. */
  size?: number
}

export function getPageSize(query: ListQuery, config?: PaginationConfig, params?: PaginationParams): number {
  const queryLimit = (query.q as SelectQueryData).limit

  const maxPageSize = config?.maxPageSize ?? config?.pageSize ?? queryLimit
  if (!maxPageSize) {
    throw new Error("Set query limit, config.maxPageSize, config.pageSize or params.limit.")
  }

  return Math.max(1, Math.min(params?.size ?? config?.pageSize ?? maxPageSize, maxPageSize))
}
