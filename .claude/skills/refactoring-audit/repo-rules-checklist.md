# Repository rules — audit checklist

Maps **AGENTS.md**, **openspec/config.yaml**, **eslint.config.mjs**, and **RTL rules** to grep heuristics in `collect-metrics.sh` and Steps 3b–3c.

Heuristics are **approximate** — every hit should be read in context before documenting. Spec files and generated code are lower priority unless counts are extreme.

**This file defines rules and greps only** — not which source files currently violate them. Violations are discovered at audit time via the metrics script.

---

## Structural complexity

| Rule                | Heuristic                              | Threshold | Typical fix                                              |
| ------------------- | -------------------------------------- | --------- | -------------------------------------------------------- |
| Long else-if chains | `\} else if \(` count per file         | ≥8        | Handler map / strategy                                   |
| Config key dispatch | `def.key ===` in conditionals          | ≥3        | Co-locate handlers with registry                         |
| Large switch        | `case ` lines per file                 | ≥10       | Discriminated union + lookup                             |
| Nested ternaries    | `\?[^?:;\n]*\?[^?:;\n]*:` on same line | ≥1 (prod) | Early return, `if/else`, helper variable, small function |

Nested ternary shape to flag:

```ts
const x = a ? b : c ? d : e;
```

Allowed exceptions (verify manually): trivial test fixtures, generated OpenAPI glue.

---

## Library isolation (AGENTS.md §Library isolation)

| Rule                     | Heuristic                                                | Expected                              |
| ------------------------ | -------------------------------------------------------- | ------------------------------------- |
| Lib imports app          | `from '.*apps/chat` or `from '@/` in `libs/**`           | **0** runtime hits                    |
| Lib imports server-api   | `server-api` in `libs/**` imports                        | **0**                                 |
| Lib imports i18n         | `react-i18next`, `useTranslation`, `/i18n/` in `libs/**` | **0**                                 |
| Generated client in libs | `@epam/chat-api-client` in hand-authored libs            | **0** runtime (specs may import DTOs) |

---

## TypeScript & imports

| Rule                               | Heuristic                          | Expected                                              |
| ---------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| Relative import extensions         | `from './foo.ts'` / `.tsx` / `.js` | **0**                                                 |
| String-literal unions for statuses | `export type Foo = 'a' \| 'b'`     | Prefer string **enums** per AGENTS.md (informational) |

---

## Frontend / RTL

| Rule                        | Heuristic                                                | Notes                                                        |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Physical Tailwind direction | `\b(ml\|mr\|pl\|pr\|text-left\|text-right\|…)` in `.tsx` | Use logical `ms/me/ps/pe/text-start/end/...`                 |
| Physical positioning        | `\b(left\|right)-[0-9]` in `.tsx`                        | Exception: `left-1/2 -translate-x-1/2` centering             |
| Hardcoded user strings      | Large English literals in `map-*`, `utils/*`             | Must use i18n — grep + manual read of top utils from metrics |
| Direct `fetch` in UI        | `\bfetch\(` in `components/`, `hooks/`                   | Use `server-api` + generated client                          |

---

## Backend

| Rule                 | Heuristic                           | Expected                 |
| -------------------- | ----------------------------------- | ------------------------ |
| `extends AppService` | class inheritance                   | **0**                    |
| Express in services  | `ExpressResponse` in `*.service.ts` | **0** in domain services |
| Route sync comments  | `MUST stay in sync`                 | Document each grep hit   |
| `console.log`        | `console.log(`                      | **0** in prod            |

---

## React / NestJS conventions (manual spot-check)

Spot-check **top god modules from metrics** (not a fixed list):

- Context value wrapped in `useMemo`
- Consumer hooks throw outside provider
- Routes lazy-loaded with `Suspense`
- NestJS: thin controllers, validated DTOs, URI versioning
- Never hand-edit `libs/chat-api-client/**`

---

## Documenting findings

Split into two sections in audit output docs:

1. **Structural smells** — complexity patterns
2. **Convention violations** — repo rule breaches

Each row: **path from this run**, rule/pattern, count, fix, priority. Drop rows on the next audit if the file no longer appears in metrics.
