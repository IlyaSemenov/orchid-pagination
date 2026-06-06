import type { PaginationConfig } from "../../limit"
import type { ListQuery } from "../../types"

import { type CursorPaginationParams, paginateByCursor } from "./paginator"

/** createCursorPaginator creates a reusable cursor paginator with the given config. */
export function createCursorPaginator(config?: PaginationConfig) {
  return function paginate<T extends ListQuery>(query: T, params?: CursorPaginationParams) {
    return paginateByCursor(query, config, params)
  }
}
