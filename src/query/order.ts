import type { ListQuery } from "../types"

export type NullsOrder = "FIRST" | "LAST"
export type OrderField = [field: string, asc: boolean, nulls: NullsOrder]

/**
 * getQueryOrderFields parses the query's ORDER BY into field and
 * direction/null-order tuples. Returns an empty array when the query is unordered.
 */
export function getQueryOrderFields(query: ListQuery): OrderField[] {
  return query.q.order?.flatMap<OrderField>((orderItem) => {
    if (typeof orderItem === "string") {
      return [[orderItem, true, "LAST"]]
    } else if (typeof orderItem === "object") {
      return Object.entries(orderItem).map<OrderField>(([field, order]) => {
        switch (order) {
          case "ASC":
          case "ASC NULLS LAST":
            return [field, true, "LAST"]
          case "ASC NULLS FIRST":
            return [field, true, "FIRST"]
          case "DESC":
          case "DESC NULLS FIRST":
            return [field, false, "FIRST"]
          case "DESC NULLS LAST":
            return [field, false, "LAST"]
          default:
            throw new Error("Unsupported order: " + order)
        }
      })
    } else {
      throw new TypeError("Unsupported order type: " + orderItem)
    }
  }) ?? []
}
