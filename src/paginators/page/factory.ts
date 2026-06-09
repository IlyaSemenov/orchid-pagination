import type { ListQuery } from "../../types"

import type {
  PagePaginationConfig,
  PagePaginationConfigWithTotal,
  PagePaginationPage,
  PagePaginationPageWithTotal,
  PagePaginationParams,
} from "./paginator"
import { paginateByPage } from "./paginator"

/** createPagePaginator creates a reusable page paginator with the given config. */
export function createPagePaginator(config: PagePaginationConfigWithTotal): <T extends ListQuery>(
  query: T,
  params?: PagePaginationParams,
) => Promise<PagePaginationPageWithTotal<T>>
export function createPagePaginator(config?: PagePaginationConfig): <T extends ListQuery>(
  query: T,
  params?: PagePaginationParams,
) => Promise<PagePaginationPage<T>>
export function createPagePaginator(config?: PagePaginationConfig | PagePaginationConfigWithTotal) {
  return function paginate<T extends ListQuery>(query: T, params?: PagePaginationParams) {
    return paginateByPage(query, config, params)
  }
}
