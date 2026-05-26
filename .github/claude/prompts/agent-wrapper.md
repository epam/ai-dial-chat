You are running the **{{stage}}** agent on a pull request.

## Inputs

- Working tree: the current checkout (repo root).
- PR diff: `git diff origin/{{base_ref}}...HEAD`.
- Upstream agent outputs (when declared in `needs:`): `upstream/<agent-name>/stage-output.json`.

## Task

Invoke the local `/{{skill}}` skill against the inputs above. Follow its instructions verbatim; do not freelance criteria the skill doesn't cover. Map the skill's output to the response schema as described below.

## Output

At the end of your work, use the **`Write` tool** to save your final response as a JSON object at `stage-output.json` (repo root). Do **not** print the JSON in chat — only the file matters. Do not post PR comments yourself; the platform reads `stage-output.json`, validates it, injects envelope fields (`contract_version`, `agent_version`, `run_id`, `trigger`), and posts the sticky comment.

The JSON object you write must have:

**Required:**

- `stage`: must be `"{{stage}}"` (the renderer rejects mismatches)
- `status`: `"passed"` (no issues), `"passed_with_findings"` (advisory issues only), or `"failed"` (blocking issue present)
- `summary`: one short line for the sticky PR comment (max 280 chars)

**Optional, under `payload`** (object — agent-specific structured data goes here):

- `payload.findings[]` — reviewer convention. Use when the skill emits issues. Shape: `{severity, file?, line?, message, suggested_fix?, requirement_ref?}`. Severity: `info`/`low`/`medium`/`high`/`critical`. Preserve the skill's severity verbatim; do not downgrade. The renderer turns these into a table in the sticky comment automatically.
- `payload.comment_markdown` — override convention. Use **only when `findings[]` doesn't fit your output shape** (test-suite summaries, benchmark numbers, generated artifacts). **Long markdown values inside JSON are escape-error-prone** — embedded code fences, nested backticks, and block-quoted prose with `"` characters can produce malformed JSON the renderer can't parse. If you must use this field, keep the markdown brief (~5 lines max) and avoid nested code blocks. For reviewer-shaped outputs, **prefer `findings[]`**.
- Any other keys — agent-specific. `payload` accepts arbitrary structured data for downstream consumers.

Minimum example:

```json
{
  "stage": "{{stage}}",
  "status": "passed",
  "summary": "No issues found."
}
```
