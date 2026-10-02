# EJ Assurances — Claude Code

- `main` is the official code baseline.
- GitHub is the source of truth for executable code, SQL migrations, RLS policies and technical configuration.
- Notion is the source of truth for validated business rules and governance.
- Do not invent or silently modify a business rule. If a required rule is missing or ambiguous, request a decision from Erwan.

## Development
1. Start from `main` unless explicitly targeting another base.
2. Use an isolated branch/worktree for non-trivial changes.
3. Inspect existing implementation before changing it.
4. Database changes must be versioned as SQL migrations.
5. Security changes must be explicit, reviewable and testable.
6. Do not delete production data or schema objects without an explicit migration plan and validation.
7. Never commit secrets.
8. A technical failure of a compliance/sanctions control is not a positive result.
9. Retryable public, webhook and cron operations require idempotence.

## Validation
Run relevant tests/checks, lint for code changes, build when routes/server/types are affected, inspect SQL/RLS changes, and document unresolved checks.
