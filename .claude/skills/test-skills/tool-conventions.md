# Skill: Tool Usage Conventions

How to use your tool sandbox efficiently without wasting turns on denials.

## Filesystem operations — use native tools, not Bash

| You want to… | Do this | NOT this |
|---|---|---|
| Read a file | `Read` tool | `cat`, `head`, `tail`, `less` |
| List a directory | `Read` tool on the directory | `ls`, `find` |
| Create / overwrite a file | `Write` tool (creates parent directories automatically) | `echo > file`, `touch`, `mkdir -p` then `echo` |
| Edit a file | `Edit` tool | `sed`, `awk`, in-place file rewriting |

`mkdir`, `ls`, `cat`, `head`, `find` are **not in any agent's allowed_tools** by design. Don't try them — the denial wastes a turn.

## Bash — atomic commands only

Claude Code's permission system parses each pipeline stage separately. **A compound command is approved only if every part matches your allowlist.**

| Don't | Do |
|---|---|
| `gh api ... \| jq '.x'` | `gh api ... --jq '.x'` |
| `gh api ... \| base64 -d` | `gh api -H 'Accept: application/vnd.github.v3.raw' ...` |
| `curl -s url \| head -20` | `gh api repos/<owner>/<repo>/contents/<path>` (then Read locally) |
| `cmd1 && cmd2` | Two separate Bash calls |

## When you get "requires approval" / "permission denied"

This means the tool or command pattern isn't in your allowlist. **Don't retry the same command** — pick a different approach from the table above. Repeated denials are visible to operators and count against the turn budget.

## File writes — defense in depth

Your `Write` tool may not be path-scoped (depends on your agent), but the workflow's "Commit state changes" step only stages files under `.state/`. **Write only to paths your CLAUDE.md instructs.** Anything else is ephemeral and discarded with the runner.

## Git — never directly

Never invoke `git add`, `git commit`, `git push`, or any `git ...` command. The workflow handles state commits in a follow-up step. If you find yourself wanting to commit, you've gone too far — just write the file and stop.
