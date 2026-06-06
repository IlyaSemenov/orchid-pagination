import { Buffer } from "node:buffer"

import type { ListQuery } from "../types"

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

/** createCursor encodes cursor parts into an opaque cursor string. */
export function createCursor(parts: string[]) {
  return Buffer.from(parts.map(String).join(String.fromCharCode(0))).toString("base64url")
}

/** parseCursor decodes an opaque cursor string into cursor parts. */
export function parseCursor(cursor: string) {
  return Buffer.from(cursor, "base64url").toString().split(String.fromCharCode(0))
}

/** createDirectedCursor encodes cursor parts and pagination direction into an opaque cursor string. */
export function createDirectedCursor(parts: string[], reverse: boolean) {
  const cursor = createCursor(parts)
  return reverse ? "-" + cursor : cursor
}

/** parseDirectedCursor decodes an opaque directed cursor string into cursor parts and pagination direction. */
export function parseDirectedCursor(directedCursor: string) {
  const [cursor, reverse] = directedCursor.startsWith("-") ? [directedCursor.slice(1), true] : [directedCursor, false]
  return { cursor, parts: parseCursor(cursor), reverse }
}
