# Database rules

- Database schema changes belong in `supabase/migrations/`.
- Access policies, grants, functions and constraints must be versioned.
- Inspect the current schema before adding or changing tables.
- Prefer additive, reversible migrations.
- Preserve data during migrations unless destructive migration is explicitly approved.
- Test affected access paths for the relevant roles.
