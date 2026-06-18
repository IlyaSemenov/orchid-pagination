import type { ListQuery } from "../../types"

type OrderField = [field: string, asc: boolean]

/** getQueryOrderFields returns ordered query fields as field and ascending-direction pairs. */
export function getQueryOrderFields(query: ListQuery): OrderField[] {
  const orderFields = query.q.order?.flatMap<[field: string, asc: boolean]>((orderItem) => {
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
  })
  if (!orderFields?.length) {
    throw new Error("Query must be ordered.")
  }
  return orderFields
}
