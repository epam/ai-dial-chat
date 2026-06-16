---
name: dial-docs
description: On-demand index of the AI DIAL Chat design docs in docs/. Use when you need ground-truth on how the app works or is built — overall architecture, technical/product requirements, or the authentication subsystem (login, logout, OIDC, session cookies, encrypted session, transparent token refresh, BFF auth flow, SessionGuard). Resolves to the one relevant doc; do not preload all of them.
---

# DIAL Docs

Ground-truth design docs live in `docs/`. This skill is the index. Open **only** the doc that matches your task — don't read all of them. When your change alters behavior a doc describes, update that doc (and any affected diagram) in the **same commit**.

## Index

| Doc                                                                                                             | Read it when                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/architecture.md`](../../../docs/architecture.md)                                                         | Orienting on the overall app: structure, layers, major decisions.                                                                                            |
| [`docs/technical-requirements.md`](../../../docs/technical-requirements.md)                                     | You need the product/technical requirements behind a feature.                                                                                                |
| [`docs/auth/auth-bff-encrypted-cookie.md`](../../../docs/auth/auth-bff-encrypted-cookie.md)                     | Changing the auth flow: stateless BFF, OIDC login/callback, encrypted session cookie, transparent refresh, federated logout, cross-pod stateless decryption. |
| [`docs/auth/testing-current-auth-implementation.md`](../../../docs/auth/testing-current-auth-implementation.md) | Writing or running auth tests: what exists today (`GET /api/v1/auth/me`, global `SessionGuard`, refresh) and how to exercise it.                             |
| [`docs/auth/auth-diagrams/`](../../../docs/auth/auth-diagrams/)                                                 | You need the picture: Mermaid `.mmd` + `.svg` for architecture, provider registry, login, refresh, logout, cross-pod, cookie structure.                      |

## How to use

1. Match your task to a row above and open that one doc.
2. For auth work, start with `auth-bff-encrypted-cookie.md`; use the diagrams for flow detail.
3. If your change alters documented behavior, edit the matching doc in the same commit.
