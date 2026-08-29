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

### Null values

Cursor pagination supports nullable order fields and PostgreSQL's `NULLS FIRST` and `NULLS LAST` behavior.
PostgreSQL uses `NULLS LAST` for `ASC` and `NULLS FIRST` for `DESC` by default, so this query orders unfinished items last:

```ts
const page = await paginateByCursor(
  db.task.order({ dueAt: "ASC", id: "DESC" }),
  { limit: 10 },
)
```

Orchid's explicit `ASC NULLS FIRST` and `DESC NULLS LAST` directions are supported as well.
Nullable database columns must be declared with `.nullable()` in the Orchid schema.

### Indexes

For `ORDER BY name ASC, id DESC`, use an index with the same fields and directions:

```sql
CREATE INDEX user_name_id_cursor_idx
ON "user" (name ASC, id DESC);
```

Add a null marker before a nullable order field:

```sql
CREATE INDEX task_due_at_id_cursor_idx
ON task ((due_at IS NULL) ASC, due_at ASC, id DESC);
```

Use `ASC` for the null marker with `NULLS LAST` and `DESC` with `NULLS FIRST`.
PostgreSQL can use the same index for backward pagination by scanning it in reverse.
PostgreSQL can seek directly to the cursor for `ASC NULLS LAST` and `DESC NULLS FIRST`.
With `ASC NULLS FIRST` or `DESC NULLS LAST`, it uses only the null marker to narrow the scan, so check deep pages with `EXPLAIN`.

When the query always filters a column by equality, put that column before the order fields:

```sql
CREATE INDEX task_account_due_at_id_cursor_idx
ON task (account_id, (due_at IS NULL) ASC, due_at ASC, id DESC);
```

Indexes for relation or computed aliases depend on the underlying SQL and should be checked with `EXPLAIN`.

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

Aliases of raw SQL expressions are not supported because SELECT output aliases are not available in the cursor `WHERE` condition.

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

### Lazy cursor pagination

Use `prepareCursorPagination` to prepare the query without executing it and finalize the fetched rows later:

```ts
import { prepareCursorPagination } from "orchid-pagination"

const { query, finalize } = prepareCursorPagination(
  db.user.where(conditions).order({ name: "ASC", id: "DESC" }),
  { limit: 10, maxLimit: 1000 },
  params,
)

const page = finalize(await query)
```

The returned query already includes the cursor condition, cursor order, hidden cursor fields, and the extra-row limit.
Execute it without further changes that can alter its selected rows or their order, then pass its result to `finalize` exactly once.

To keep finalization inside an Orchid query pipeline, compose it with `transform`:

```ts
const page = await query.transform(finalize)
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
