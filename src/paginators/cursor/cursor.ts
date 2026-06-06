import { Buffer } from "node:buffer"

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
