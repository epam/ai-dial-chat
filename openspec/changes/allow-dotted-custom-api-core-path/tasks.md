Slicing: one slice; the rule, its tests and its documentation change together.

## 1. Path rule

- [x] 1.1 `apps/chat-api/src/custom-api/custom-api-registry.service.ts`: `CORE_PATH_PATTERN` accepts `.` inside a
      segment and rejects a segment that is exactly `.` or `..`; the comment says why.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api-registry.service.spec.ts`
- [x] 1.2 Tests: `/..`, `/.`, `/items/../admin`, `/items/./all` and `/items/..` are rejected next to the existing
      unsafe paths; an application route path with `runner__1.0.0`, `/items/.well-known` and `/items/v1.2/...` are
      accepted; `resolveCustomApiDestination` keeps a dotted segment unchanged and throws on `/items/../admin`.
      Verification: same file as 1.1.

## 2. Docs and gates

- [x] 2.1 `apps/chat-api/README.md`: the `corePath` rule names dots inside a segment and the `.`/`..` exception.
- [x] 2.2 `npm run verify:changed`; `npm run validate:docs`; `npm run validate:specs`.
