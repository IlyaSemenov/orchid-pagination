/**
 * Minimal ref metadata shape reverse-engineered from and verified against
 * Orchid ORM 1.68.5.
 */
export type QueryFieldRef = {
  toSQL(): string
  result?: {
    value?: {
      dataType?: string
      data?: {
        isNullable?: boolean
        key?: string
      }
    }
  }
}
