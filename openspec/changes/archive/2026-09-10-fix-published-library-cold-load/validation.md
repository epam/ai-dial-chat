# Validation

Checked on 2026-09-10 against the local working tree.

- Affected-project production build: passed.
- Source-content behavioral tests: 30 passed; publishing/fixture unit tests: 25 passed.
- Seven packed import probes: passed fixed raw/gzip budgets and semantic exclusions.
- Coherent release installation/declarations and an existing mixed-artifact negative case: 2 passed, without peer overrides.
- Source/packed browser hosts: deferred mounts and reopen, required styles, OAuth identity, markdown reload recovery and mobile/RTL passed.
- Startup JS: source 1,196,820 B raw / 348,248 B gzip; packed 1,213,244 B / 354,409 B. Static and browser observations agree; ratios are 1.014 / 1.018, below 1.20. Shared stylesheet artifacts are loaded by both hosts.
- Public root exports: no removals across the four packages. Documentation and strict OpenSpec validation passed.
- chat-hooks lint passed. `verify:changed` stops at existing lint errors in the attachment consumer fixture and chat app; `verify:full` stops at existing API/MCP-sandbox type errors.

Task 2.6 remains open: same-document loader recovery and attachment PDF/office/editor browser coverage are not proven by the current reload and module-loading checks. This change is not ready to archive until that acceptance work is complete.
