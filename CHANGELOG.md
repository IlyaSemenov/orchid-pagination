# orchid-pagination

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
