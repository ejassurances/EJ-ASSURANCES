# Testing rules

For each change: identify the smallest relevant check; run lint for source changes; run build when routes, server code, types or dependencies are affected; validate database migrations and access logic; record checks that could not be executed.

Never state that a migration or production deployment was validated if it was only written to GitHub.
