# Captured `GET /api/v1/user/usage` payloads

`user-usage-with-resets-at.json` is a **real** payload captured from a DIAL Core environment on
2026-09-15 (13 deployments, the caller's own spend figures). It is the provenance record for every
`resetsAt` fixture in this change. Per-project test fixtures reproduce its values rather than
importing this file, because a single shared module cannot cross the
`apps/chat-api` / `libs/usage-dashboard` / `apps/chat` boundaries without violating the library
isolation rule in `AGENTS.md`. Each fixture module cites this directory.

`user-usage-without-resets-at.json` is **derived**, not captured — it is the same payload with every
`resetsAt` key stripped. A payload in which DIAL Core genuinely omits the field could not be
captured, because the Core environment available here always sends it.

## What the captured payload establishes

| Question | Answer from the capture |
| --- | --- |
| Is `resetsAt` sent for day/week/month stats? | Yes — on every `day*`/`week*`/`month*` token, cost, **and** request stat |
| Does it appear on `minuteCostStats` / `hourRequestStats`? | No — `minuteCostStats`, `minuteTokenStats`, and `hourRequestStats` never carry it |
| Do per-deployment stats carry it? | Yes, all 13 deployments carry it on their day/week/month stats |
| Format guarantee | Always an explicit `Z`, always second precision: `2026-09-16T00:00:00Z` |
| Exclusive end of the current period? | Consistent with it — the capture's "today" is 15 Sep and the day boundary is `2026-09-16T00:00:00Z` |
| Is the week boundary a UTC Monday? | `2026-09-21` is a Monday, so yes in this environment |
| Is the top-level cost budget ever finite? | Yes — `dayCostStats.total: 110` and `monthCostStats.total: 500` are finite while `weekCostStats.total` is the sentinel, so a payload mixes finite and unlimited aggregate periods |
| Is per-deployment cost `total` always the sentinel? | Yes in this capture — all 13 deployments report `9223372036854776000` for every `*CostStats` |

`9223372036854776000` is `Long.MAX_VALUE` after `JSON.parse` rounds it to the nearest double; it is
the sentinel every consumer detects with `total >= 2 ** 53`.
