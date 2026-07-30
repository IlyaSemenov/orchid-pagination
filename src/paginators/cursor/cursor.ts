import { Buffer } from "node:buffer"

export type CursorPart = string | null

/** createCursor encodes cursor parts into an opaque cursor string. */
export function createCursor(parts: CursorPart[]) {
  return Buffer.from(JSON.stringify(parts)).toString("base64url")
}

/** parseCursor decodes an opaque cursor string into cursor parts. */
export function parseCursor(cursor: string): CursorPart[] | undefined {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString())
    return Array.isArray(parsed) && parsed.every(part => part === null || typeof part === "string")
      ? parsed
      : undefined
  } catch {
    return undefined
  }
}

/** createDirectedCursor encodes cursor parts and pagination direction into an opaque cursor string. */
export function createDirectedCursor(parts: CursorPart[], reverse: boolean) {
  const cursor = createCursor(parts)
  return reverse ? "-" + cursor : cursor
}

/** parseDirectedCursor decodes an opaque directed cursor string into cursor parts and pagination direction. */
export function parseDirectedCursor(directedCursor: string) {
  const [cursor, reverse] = directedCursor.startsWith("-") ? [directedCursor.slice(1), true] : [directedCursor, false]
  const parts = parseCursor(cursor)
  return parts && { cursor, parts, reverse }
}
