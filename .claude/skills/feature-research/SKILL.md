---
name: feature-research
description: Researches large feature directions using best practices. Use when the user asks to investigate global features, compare approaches, assess risks/trade-offs, and recommend an implementation path before coding.
---

# Feature Research

## Overview

Use this skill to perform structured, source-grounded research before implementation. The goal is to reduce rework and clarify decisions for broad or high-impact features.

## When to Use

- The request is broad (architecture, cross-cutting, platform-level)
- Multiple valid approaches exist
- The user asks for "best practices", trade-offs, or recommendations
- The team needs a decision record before implementation

## Research Process

1. **Clarify scope**
   - What problem are we solving?
   - What constraints matter (time, compatibility, infra, security, performance)?
   - What is explicitly out of scope?
   - If hand-authored `libs/*` may be involved, what host/external integration knowledge must stay outside the lib?
   - If `libs/chat-api-client` may be involved, is this a generated OpenAPI-client update?

2. **Map options**
   - Produce 2-4 realistic options (not one obvious answer)
   - Include a conservative baseline option
   - Prefer options where apps adapt external interfaces and libs receive props, callbacks,
     resolved values, or narrow interfaces instead of knowing transport details

3. **Gather evidence**
   - Use authoritative sources first (official docs, standards, mature references)
   - Distinguish facts from assumptions
   - Flag unknowns explicitly

4. **Evaluate trade-offs**
   - Correctness and maintainability
   - Complexity and delivery risk
   - Security and performance implications
   - Migration and rollback impact

5. **Recommend a path**
   - Pick one option as primary recommendation
   - Explain why alternatives were not chosen
   - Define phased rollout (thin vertical slices)

## Output Contract

When delivering research, provide:

- **Context:** problem statement, constraints, non-goals
- **Options:** each option in 3-6 bullets
- **Comparison:** pros/cons/risks table
- **Recommendation:** chosen option and rationale
- **Execution draft:** first increments and verification plan
- **Library boundary:** for any touched hand-authored `libs/*`, where host/external concerns live
  (API, routes/navigation, auth/session, storage, feature flags, analytics/telemetry, SDKs,
  platform bridges, download/upload URL construction, etc.) and what contract the lib receives
  For `libs/chat-api-client`, state that it is the generated OpenAPI-client exception and how it
  will be regenerated/verified.
- **Open questions:** what must be decided before implementation

## Quality Bar

- No implementation without a clear recommendation or explicit uncertainty
- No "best practice" claims without concrete evidence
- Avoid one-sided analysis; include meaningful alternatives
- Keep recommendations actionable for this repo's Nx setup
- Do not recommend putting host-owned integration details into hand-authored `libs/*`: REST paths,
  generated clients, server-api wrappers, app contexts, auth/session/cookie/env access, feature
  flags, route/navigation knowledge, analytics/telemetry/logging clients, deployment/tenant/
  provider details, third-party SDK setup, platform bridges, app-specific URL schemes, or storage
  keys/schemas. `libs/chat-api-client` is the generated OpenAPI-client exception and should be
  changed by regenerating from OpenAPI sources.

## Verification Checklist

- [ ] Scope and constraints are explicit
- [ ] At least 2 viable options are compared
- [ ] Risks and rollback strategy are described
- [ ] Recommendation is concrete and justified
- [ ] Next implementation slices are proposed
- [ ] If hand-authored libs are involved, the app/lib integration boundary is explicit and isolated
- [ ] If `libs/chat-api-client` is involved, the OpenAPI generation and verification path is explicit
