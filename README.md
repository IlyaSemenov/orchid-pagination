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
  const page = await paginateByPage(query, { pageSize: 10, maxPageSize: 1000 }, ctx.params)
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

The page will have `items`, and possibly `nextPage` and/or `prevPage`.

## Cursor pagination

```ts
import { paginateByCursor } from "orchid-pagination"

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { cursor?, size? }
  const page = await paginateByCursor(query, { pageSize: 10, maxPageSize: 1000 }, ctx.params)
  return page
})
```

Alternatively, pre-create the paginator:

```ts
import { createCursorPagination } from "orchid-pagination"

const paginate = createCursorPagination({ pageSize: 10, maxPageSize: 1000 })

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { cursor?, size? }
  const page = await paginate(query, params)
  return page
})
```

The page will have `items`, and possibly `nextCursor` and/or `prevCursor` which should be sent in subsequent calls to paginate forth and back.
