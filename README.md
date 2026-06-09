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

### No total count by default

By default, this library does not run `COUNT(*)` queries, keeping pagination fast and lightweight.
If a requested page is beyond the last page, the result contains an empty `items` array and keeps the requested page number unchanged.

Set `total: true` to include `totalItems` and `totalPages` in the response.
Pages beyond the last page are still left unchanged; to clamp them to the last available page, set `clampPage: true` together with `total: true`.

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

### Aliases and relations

You can order by selected aliases or by relation paths:

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

```ts
const page = await paginateByCursor(
  db.post
    .select("id", "text", {
      author: q => q.author.select("id", "name"),
    })
    .order("author.name", { id: "DESC" }),
  { limit: 10 },
)
```

## Pagination config

- `limit`: default page size.
- `maxLimit`: maximum accepted client-provided `limit`.
- Client-provided `limit` is only used when `maxLimit` is set.
- If `maxLimit` is set without `limit`, client-provided `limit` is required.
- If no config is provided, the query must already have `.limit(...)`.

### Page number pagination

- `total`: run a `COUNT(*)` query and include `totalItems` / `totalPages` in the response.
- `clampPage`: clamp pages beyond the last page to the last available page. Requires `total: true`.
