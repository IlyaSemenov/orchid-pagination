---
"orchid-pagination": patch
---

Fix cursor pagination by `timestamp without time zone` columns in non-UTC time zones so adjacent pages do not repeat or skip rows.
