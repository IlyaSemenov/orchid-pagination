import { Buffer } from "node:buffer"

import type { SelectQueryData } from "orchid-orm"

import type { ListQuery } from "../base"

type OrderField = [field: string, asc: boolean]

export function getQueryOrderFields(query: ListQuery): OrderField[] {
  const orderFields = (query.q as SelectQueryData).order?.flatMap<[field: string, asc: boolean]>((orderItem) => {
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

export function createCursor(parts: string[]) {
  return Buffer.from(parts.map(String).join(String.fromCharCode(0))).toString("base64url")
}

export function parseCursor(cursor: string) {
  return Buffer.from(cursor, "base64url").toString().split(String.fromCharCode(0))
}

export function createDirectedCursor(parts: string[], reverse: boolean) {
  const cursor = createCursor(parts)
  return reverse ? "-" + cursor : cursor
}

export function parseDirectedCursor(directedCursor: string) {
  const [cursor, reverse] = directedCursor.startsWith("-") ? [directedCursor.slice(1), true] : [directedCursor, false]
  return { cursor, parts: parseCursor(cursor), reverse }
}
