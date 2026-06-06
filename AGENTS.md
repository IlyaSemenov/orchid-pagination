## Tests

This project uses Bun.

- Build: `bun run build`
- Type check: `bun types`
- Unit tests: `bun test`

Tests run against the default local Postgres database; override this in `.env` if needed.
The database should be empty; tests roll back all changes automatically.
