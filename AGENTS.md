# Agent policy

Claude Code may use specialized sub-agents for bounded tasks.

## security-auditor
Reviews authentication, authorization, RLS, public routes, secrets, webhook/cron authentication, idempotence and sensitive-data exposure. It audits and reports; it does not invent business rules.

## code-reviewer
Reviews correctness, regression risk, maintainability, tests and consistency with repository conventions. It flags business-rule ambiguity rather than resolving it.

Sub-agents must not silently change validated business rules, weaken security, delete data/schema, bypass tests or merge directly to `main`.
