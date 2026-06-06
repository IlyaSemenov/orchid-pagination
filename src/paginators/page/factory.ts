import type { PaginationConfig } from "../../limit"
import type { ListQuery } from "../../types"

import { type PagePaginationParams, paginateByPage } from "./paginator"

/** createPagePaginator creates a reusable page paginator with the given config. */
export function createPagePaginator(config?: PaginationConfig) {
  return function paginate<T extends ListQuery>(query: T, params?: PagePaginationParams) {
    return paginateByPage(query, config, params)
  }
}
