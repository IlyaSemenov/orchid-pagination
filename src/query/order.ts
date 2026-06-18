import type { ListQuery } from "../types"

export type OrderField = [field: string, asc: boolean]

/**
 * getQueryOrderFields parses the query's ORDER BY into field and
 * ascending-direction pairs. Returns an empty array when the query is unordered.
 */
export function getQueryOrderFields(query: ListQuery): OrderField[] {
  return query.q.order?.flatMap<[field: string, asc: boolean]>((orderItem) => {
    if (typeof orderItem === "string") {
      return [[orderItem, true]]
    } else if (typeof orderItem === "object") {
      return Object.entries(orderItem).map<[string, boolean]>(([field, order]) => {
        if (order === "ASC" || order === "DESC") {
          return [field, order === "ASC"]
        } else {
          throw new Error("Unsupported order: " + order)
        }
      })
    } else {
      throw new TypeError("Unsupported order type: " + orderItem)
    }
  }) ?? []
}
