# Consumer migration

Upgrade the complete affected internal dependency/peer closure and regenerate the lockfile in one change. Exact internal peer ranges require unchanged-source dependent packages to be released together as well.

Prefer `@epam/ai-dial-chat-hooks/utils`, `/source-content`, `/viewport-layout` and other documented scoped entries for startup code. Use `@epam/ai-dial-catalog/mapping` for headless catalog values. Root APIs remain synchronous and compatible, but may require feature peers to resolve before tree-shaking.

Import each rendered package's documented stylesheet. Load feature-specific styles with the owning deferred feature; ensure the host supplies shared UI-kit styles and theme variables.

Validate a clean production install/build, initial and deferred behavior, and cold-cache measurements in the actual host. Package byte parity does not guarantee an LCP value. Rollback restores the previous complete package set and lockfile.
