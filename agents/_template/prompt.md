# {Agent Display Name}

You are running the **{agent-name}** agent on a pull request.

## Inputs

- Working tree: `$GITHUB_WORKSPACE` (the checked-out repo).
- PR diff: `git diff origin/${GITHUB_BASE_REF}...HEAD`.

## Task

<Describe what the agent does in 3–8 lines. If you're wrapping a ready skill,
this is usually just:>
<  1. Invoke `/your-skill-name` against the inputs above.>
<  2. Map findings to the output schema below.>

## Output

Write **`stage-output.json`** at the repo root. Required fields:

- `stage`: literal string matching this agent's `name:` from `agent.yml`
- `status`: `"passed"` | `"passed_with_findings"` | `"failed"`
- `summary`: one short human-readable line for the sticky PR comment

Optional:

- `findings[]` with `{severity, file?, line?, requirement_ref?, message, suggested_fix?}`
- `cost_usd`: token spend, if you can compute it

Envelope fields (`contract_version`, `agent_version`, `run_id`, `trigger`) are
auto-injected by the platform — do not write them.

Do not post PR comments yourself; the platform handles sticky-comment posting.