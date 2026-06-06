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
  const params = getValidatedParams(ctx) // prepare object with { page?, limit? }
  const page = await paginateByPage(query, { limit: 10, maxLimit: 1000 }, params)
  return page
})
```

Alternatively, pre-create the paginator:

```ts
import { createPagePaginator } from "orchid-pagination"

const paginate = createPagePaginator({ limit: 10, maxLimit: 1000 })

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { page?, limit? }
  const page = await paginate(query, params)
  return page
})
```

The page has `{ items, page, limit, offset, prevPage?, nextPage? }`.

## Cursor pagination

```ts
import { paginateByCursor } from "orchid-pagination"

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { cursor?, limit? }
  const page = await paginateByCursor(query, { limit: 10, maxLimit: 1000 }, params)
  return page
})
```

Alternatively, pre-create the paginator:

```ts
import { createCursorPaginator } from "orchid-pagination"

const paginate = createCursorPaginator({ limit: 10, maxLimit: 1000 })

defineEventHandler(async (ctx) => {
  const query = db.user.where(conditions).order({ name: "ASC", id: "DESC" })
  const params = getValidatedParams(ctx) // prepare object with { cursor?, limit? }
  const page = await paginate(query, params)
  return page
})
```

The page has `{ items, limit, prevCursor?, nextCursor? }`.

Cursor queries must be ordered.
Include a deterministic tie-breaker, usually `id`.
Treat cursors as opaque strings and pass them back unchanged.

You can order by selected relation fields and aliases as long as the ordered value is present in the query result:

```ts
const page = await paginateByCursor(
  db.post
    .select("id", "text", {
      authorName: q => q.author.get("name"),
    })
    .order("authorName", { id: "DESC" }),
  { limit: 10 },
)
```

## Pagination config

- `limit`: default limit.
- `maxLimit`: max accepted client `limit`.
- Client `limit` is ignored unless `maxLimit` is set.
- With only `maxLimit`, client `limit` is required.
- Without config, query `.limit(...)` is required.
