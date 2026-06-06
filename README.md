# orchid-pagination

Pagination helpers for Orchid ORM:

- Page number pagination.
- Cursor pagination (better for larger datasets).

## Install

```sh
npm install orchid-pagination
```

## Page number pagination

```ts
import { paginateByPage } from "orchid-pagination"

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { page?, size? }
  const page = await paginateByPage(query, { pageSize: 10, maxPageSize: 1000 }, params)
  return page
})
```

Alternatively, pre-create the paginator:

```ts
import { createPagePaginator } from "orchid-pagination"

const paginate = createPagePaginator({ pageSize: 10, maxPageSize: 1000 })

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { page?, size? }
  const page = await paginate(query, params)
  return page
})
```

The page has `{ items, page, size, offset, prevPage?, nextPage? }`.

## Cursor pagination

```ts
import { paginateByCursor } from "orchid-pagination"

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { cursor?, size? }
  const page = await paginateByCursor(query, { pageSize: 10, maxPageSize: 1000 }, params)
  return page
})
```

Alternatively, pre-create the paginator:

```ts
import { createCursorPaginator } from "orchid-pagination"

const paginate = createCursorPaginator({ pageSize: 10, maxPageSize: 1000 })

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { cursor?, size? }
  const page = await paginate(query, params)
  return page
})
```

The page has `{ items, size, prevCursor?, nextCursor? }`.

Cursor queries must be ordered.
Include a deterministic tie-breaker, usually `id`.
Treat cursors as opaque strings and pass them back unchanged.

## Pagination config

- `pageSize`: default page size.
- `maxPageSize`: max accepted `size`.
- Requested `size` is clamped to `[1, maxPageSize]`.
- Without config, query `.limit(...)` is required and used as the max size.
