## Tests

This project uses Bun.

- Build: `bun run build`
- Type check: `bun run types`
- Unit tests: `bun run test`

Tests run against the default local Postgres database; override this in `.env` if needed.
The database should be empty; tests roll back all changes automatically.

## Sandbox

- If PostgreSQL on `localhost:5432` fails with `ECONNREFUSED` inside the sandbox, rerun the command with sandbox escalation before concluding that PostgreSQL is unavailable.
