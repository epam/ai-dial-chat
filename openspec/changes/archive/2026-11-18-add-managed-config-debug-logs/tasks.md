## 1. Logs

- [x] 1.1 Log the startup line and the per-read debug line in `managed-runtime.service.ts`. Verify `app-config/tests/managed-runtime/managed-debug-logs.spec.ts`: the off and active lines, "reader key missing", no reader key in the line, and one debug line per read without payload text.
- [x] 1.2 Run chat-api typecheck, lint, and the managed-runtime tests, `validate:specs`, and strict OpenSpec validation. Verify: all pass.
