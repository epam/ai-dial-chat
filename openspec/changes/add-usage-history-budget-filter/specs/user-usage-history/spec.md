## ADDED Requirements

### Requirement: Usage history narrowed to one budget

`GET /api/v1/user/usage/history` SHALL accept optional `costObject` and `policy` query parameters. When both are
present, every figure of an available response SHALL cover only the model calls that budget paid for: rows of the
window whose `budget_cost_object` equals `costObject`, whose `budget_policy` equals `policy` and whose
`budget_outcome` is `paid`, at any depth of the call chain, with spend summed from `deployment_price`. The response
SHALL then include `budget` with the requested `costObject` and `policy`, and `requests` SHALL count those model calls.
Without the parameters, the queries and the response SHALL be unchanged and SHALL NOT include `budget`. The values
SHALL reach DIAL Analytics only as string literals of the fixed structured queries.

#### Scenario: Budget narrowing

- **WHEN** a signed-in caller requests `period=month&costObject=engineering&policy=policies/company/pro` and DIAL
  Analytics lists the budget columns
- **THEN** every query filters the window by the three budget predicates without the root-span predicate, sums
  `deployment_price`, and the body includes `budget: { costObject: "engineering", policy: "policies/company/pro" }`

#### Scenario: No budget requested

- **WHEN** the caller requests only `period`
- **THEN** the queries keep the root-span predicate and `total_price`, and the body has no `budget`

### Requirement: Budget parameters are validated together

The route SHALL answer `400` without any call to DIAL Analytics when only one of `costObject` and `policy` is present,
when either is empty or longer than 1024 characters, or when either is repeated.

#### Scenario: Cost object alone

- **WHEN** the caller requests `period=today&costObject=engineering`
- **THEN** the response is `400` and no request reaches DIAL Analytics

### Requirement: Budget narrowing unsupported by DIAL Analytics

The route SHALL answer `200` with `available: false` and reason `budget_unsupported`, run no usage query, and
log the cause at `warn`, when a budget is requested and the caller's schema of `dial_usage_log` does not list
`budget_cost_object`, `budget_policy` and `budget_outcome`. The row-restriction guard SHALL still apply
first, and a failed schema read SHALL answer `forbidden` for `401`/`403` and `unavailable` otherwise.

#### Scenario: ADAS without budget columns

- **WHEN** a budget is requested and the schema lists no budget columns
- **THEN** the body is `{ "available": false, "reason": "budget_unsupported" }` and no query is executed
