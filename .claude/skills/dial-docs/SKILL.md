---
name: dial-docs
description: On-demand index of the AI DIAL Chat design docs in docs/. Use when you need ground-truth on how the app works or is built — overall architecture, technical/product requirements, the authentication subsystem (login, logout, OIDC, session cookies, encrypted session, transparent token refresh, BFF auth flow, SessionGuard), theme customization and color tokens, embedding the chat through the overlay, the Responses API integration, or environment-variable migration. Resolves to the one relevant doc; do not preload all of them.
---

# DIAL Docs

Ground-truth design docs live in `docs/`. This skill is the index. Open **only** the doc that matches your task — don't read all of them.

## Index

| Doc                                                                                                             | Read it when                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/architecture.md`](../../../docs/architecture.md)                                                         | Orienting on the overall app: structure, layers, major decisions.                                                                                              |
| [`docs/technical-requirements.md`](../../../docs/technical-requirements.md)                                     | You need the product/technical requirements behind a feature.                                                                                                  |
| [`docs/auth/auth-bff-encrypted-cookie.md`](../../../docs/auth/auth-bff-encrypted-cookie.md)                     | Changing the auth flow: stateless BFF, OIDC login/callback, encrypted session cookie, transparent refresh, federated logout, cross-pod stateless decryption.   |
| [`docs/auth/testing-current-auth-implementation.md`](../../../docs/auth/testing-current-auth-implementation.md) | Writing or running auth tests: what exists today (`GET /api/v1/auth/me`, global `SessionGuard`, refresh) and how to exercise it.                               |
| [`docs/auth/auth-diagrams/`](../../../docs/auth/auth-diagrams/)                                                 | You need the picture: Mermaid `.mmd` + `.svg` for architecture, provider registry, login, refresh, logout, cross-pod, cookie structure.                        |
| [`docs/legacy-chat-migration-guide.md`](../../../docs/legacy-chat-migration-guide.md)                           | Moving a deployment from the legacy DIAL Chat (0.x) to 1.0: what changed, the checklist, and the legacy → new environment-variable mapping.                    |
| [`docs/theme-customization.md`](../../../docs/theme-customization.md)                                           | Theming: the themes service and `config.json` format, the color tokens the app reads, logos and favicon, the light/dark/system picker, legacy theme migration. |
| [`docs/chat-overlay-migration-guide.md`](../../../docs/chat-overlay-migration-guide.md)                         | Embedding the chat: the overlay package, `postMessage` protocol and handshake, `OverlayFeature` flags, and migrating from the legacy `@epam/ai-dial-overlay`.  |
| [`docs/responses-api-integration.md`](../../../docs/responses-api-integration.md)                               | Working on completions dispatch: how deployments declaring `responses_api` are routed and normalized.                                                          |
| [`apps/chat-api/README.md`](../../../apps/chat-api/README.md)                                                   | The full environment-variable reference: every supported variable, its default, and its effect. `apps/chat-api/.env.template` is the annotated source.         |

## How to use

1. Match your task to a row above and open that one doc.
2. For auth work, start with `auth-bff-encrypted-cookie.md`; use the diagrams for flow detail.

## Maintaining the index

Adding a doc to `docs/` means adding a row here in the same change — an unindexed doc is one nobody finds. `docs/architecture.md` additionally has a standing update obligation (new lib, app, backend domain, context, route, or endpoint group); see the Docs section of `AGENTS.md`.
