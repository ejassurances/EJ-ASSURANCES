# Security rules

- Treat all public input as untrusted.
- Validate and bound request bodies.
- Rate-limit public endpoints where appropriate.
- Use server-side authorization; never rely on hidden UI controls.
- Keep service-role credentials server-side only.
- Use idempotency for retryable public/webhook/cron operations that create records or external side effects.
- A failed compliance, sanctions or identity control is not equivalent to a successful check.
- Never log secrets or unnecessary sensitive personal data.
- RLS and database constraints must be versioned in SQL migrations.
- Security-sensitive changes require explicit review before merge.
