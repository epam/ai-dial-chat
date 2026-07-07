# Label Reference

Always use the exact label names below. When uncertain whether a label applies, ask — never guess (see Guardrails in `SKILL.md`).

| Label               | Applied When                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bug`               | Type = Bug                                                                                                                                                                                                   |
| `enhancement`       | Type = Feature                                                                                                                                                                                               |
| `to-be-documented`  | Type = Feature (always)                                                                                                                                                                                      |
| `infra-task`        | Type = Task AND infra signals detected (keywords: env var, secret, config change, deployment, prod/uat, `LOG_LEVEL`, etc.) OR user invoked `/create-ticket infra: …` OR user confirms "Yes, infra" in Step 3 |
| `Priority-Low`      | User selects Low priority                                                                                                                                                                                    |
| `Priority-Medium`   | User selects Medium priority                                                                                                                                                                                 |
| `Priority-High`     | User selects High priority                                                                                                                                                                                   |
| `Severity-Low`      | Bug — user selects Low                                                                                                                                                                                       |
| `Severity-Minor`    | Bug — user selects Minor                                                                                                                                                                                     |
| `Severity-Major`    | Bug — user selects Major                                                                                                                                                                                     |
| `Severity-Critical` | Bug — user selects Critical                                                                                                                                                                                  |
| `Design Required`   | Auto or asked — see Step 5                                                                                                                                                                                   |
| `SIA-required`      | Auto or asked — see Step 5                                                                                                                                                                                   |
| `SIA-not required`  | User confirms no security impact                                                                                                                                                                             |
