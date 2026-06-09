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

**No total count.**
This library intentionally avoids `COUNT(*)` queries for performance.
As a consequence, requesting a page beyond the last one returns an empty `items` array with the requested page number as-is — the library cannot distinguish "page too far" from "legitimately empty result" without a count.
If you need `total` / `totalPages`, run a separate `query.count()` call.

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
