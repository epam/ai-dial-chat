## 1. Proxy endpoint (vertical slice, contract first)

Slicing strategy: vertical. One path (browser → BFF → Core route) working end to end, then its safety and failure behaviour. Reference: `apps/chat-api/AGENTS.md` (domain layout, URI versioning, thin controllers).

- [x] 1.1 Add `apps/chat-api/src/deployment-route/deployment-route.controller.ts`: `@Controller({ path: 'deployment-route', version: '1' })`, `@All(':id/*path')`, `@ApiExcludeEndpoint()`; build `{DIAL_CORE_URL}/v1/deployments/{id}/route/{path}{query}` with per-segment encoding, call `DialClientService.fetchCore` with the caller's bearer token and a 60 s timeout, `redirect: 'manual'`
- [x] 1.2 Forward a non-empty JSON body as `application/json` for non-`GET` methods; relay status, `Content-Type` and body bytes, and set `Cache-Control: private, no-store`
- [x] 1.3 Refuse `.`/`..` segments (400) and non-`GET`/`POST`/`PUT`/`DELETE` methods (405) before any Core call; map a network failure to 503 and the deadline to 504
- [x] 1.4 Add `apps/chat-api/src/deployment-route/deployment-route.module.ts` and register `DeploymentRouteModule` in `apps/chat-api/src/app/app.module.ts`

## 2. Tests

- [x] 2.1 Add `apps/chat-api/src/deployment-route/tests/deployment-route.controller.spec.ts` (supertest): URL and token mapping, encoded deployment ID with slashes, query and JSON body forwarding, `PUT`/`DELETE`, upstream 422 relayed intact, dot-segment 400 via a raw HTTP request, 405, 503, 504

## 3. Verification

- [x] 3.1 Run `npx vitest run src/deployment-route` in `apps/chat-api`, then typecheck (`tsc -p apps/chat-api/tsconfig.app.json --noEmit`) and lint the new files
- [x] 3.2 Run `openspec validate add-deployment-route-proxy`

## 4. Follow-ups (out of scope)

- [ ] 4.1 Decide on a deployment allowlist env and per-principal admission for the endpoint (see `design.md` Open Questions)
