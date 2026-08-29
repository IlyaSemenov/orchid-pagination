# orchid-pagination

## 2.4.0

### Minor Changes

- dc455bc: Add `prepareCursorPagination` for executing cursor pagination queries lazily and finalizing their results separately.

### Patch Changes

- befc660: Support cursor pagination by selected scalar relation aliases with Orchid ORM 1.78.5.

## 2.3.1

### Patch Changes

- 43069ff: Fix cursor pagination for Orchid queries whose `.map()` transforms rename, nest, or omit order fields.

## 2.3.0

### Minor Changes

- 146671b: Support nullable fields and explicit null ordering in cursor pagination.
  Cursor payloads now use JSON encoding, so cursors created by earlier versions are not accepted.

## 2.2.0

### Minor Changes

- 7405b8e: Auto-inject temporary field aliases in cursor pagination when ordering on non-selected fields.

## 2.1.1

### Patch Changes

- fcf8798: Fail-fast on cursor pagination when an order field is missing in the result.

## 2.1.0

### Minor Changes

- dee1f2d: Add `total` and `clampPage` options to page number paginator.

## 2.0.0

### Major Changes

- f6c55a2: Replace `size` with `limit`.

### Minor Changes

- 2cc35ce: Update to orchid-orm 1.68

### Patch Changes

- d28cbb9: Support ordering on relation fields in cursor pagination.
- a02200f: Fix `createCursorPaginator` to return synchronously.

## 1.0.0

### Major Changes

- 761cdd0: Initial release.
