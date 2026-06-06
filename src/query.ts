import type { Query, QueryThen } from "orchid-orm"

export interface ListQuery extends Query {
  then: QueryThen<unknown[]>
}
