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

Your **final response** is a JSON object that the platform validates against
its schema (passed via `--json-schema` to Claude). You don't write a file;
the structured response itself is the output. Required fields:

- `status`: `"passed"` | `"passed_with_findings"` | `"failed"`
- `summary`: one short human-readable line for the sticky PR comment

(The `stage` field is pinned to your agent's `name:` from `agent.yml`; the
platform enforces it — your output can omit it or set it; the platform
injects envelope fields `contract_version`, `agent_version`, `run_id`,
`trigger` after you exit.)

Optional:

- `findings[]` with `{severity, file?, line?, requirement_ref?, message, suggested_fix?}`
- `cost_usd`: token spend, if you can compute it

Do not post PR comments yourself; the platform handles sticky-comment posting.