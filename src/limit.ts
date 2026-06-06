import type { SelectQueryData } from "orchid-orm"

import type { ListQuery } from "./query"

export interface PaginationConfig {
  /** Default limit. If `maxLimit` is not set, client params limit is ignored. */
  limit?: number
  /** Max limit allowed to be passed in params. */
  maxLimit?: number
}

export interface PaginationParams {
  /** Requested limit. */
  limit?: number
}

/** getLimit returns the effective limit for a query and pagination parameters. */
export function getLimit(query: ListQuery, config?: PaginationConfig, params?: PaginationParams): number {
  if (config) {
    const limit = config.maxLimit !== undefined ? (params?.limit ?? config.limit) : config.limit
    if (limit === undefined) {
      throw new Error("Set config.limit or params.limit with config.maxLimit.")
    }

    return Math.max(1, Math.min(limit, config.maxLimit ?? limit))
  }

  const queryLimit = (query.q as SelectQueryData).limit
  if (!queryLimit) {
    throw new Error("Set query limit or config.limit.")
  }

  return Math.max(1, queryLimit)
}
