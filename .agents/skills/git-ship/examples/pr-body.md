# PR body — ai-dial-chat

Always follow the repo PR template at `.github/pull_request_template.md`. Fill every placeholder;
never leave `<SHORT_DESCRIPTION>` or `<TICKET_ID>` unreplaced.

## Template structure

```markdown
**Description:**

<2-4 sentences: what changed and why. Explain the _why_, not just the _what_.>

Issues:

- Issue #<ticket>

**UI changes**

<Screenshots or Figma links. Write "No UI changes" if none.>

**Checklist:**

- [x] the pull request name complies with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [x] the pull request name starts with `fix(<scope>):`, `feat(<scope>):`, `chore(<scope>):` etc. where `<scope>` is the affected project
- [x] the pull request name ends with `(Issue #<TICKET_ID>)` (comma-separated list of issues)
- [x] I confirm that do not share any confidential information like API keys or any other secrets and private URLs
```

## Rules for filling it

- **Description**: required — always write a real summary, even for small chores. Explain the _why_.
- **Issues**: one `- Issue #<ticket>` line per ticket. If there is genuinely no ticket, remove the
  `Issues:` block and leave the third checklist item **unchecked** (`[ ]`), since the title can't end
  with `(Issue #…)`.
- **UI changes**: paste screenshots / Figma links for any visible change; otherwise "No UI changes".
- **Checklist**: tick `[x]` only what the PR actually satisfies. The first three are about the title
  format (this skill produces a Conventional Commits title with scope and `(Issue #…)`), the last is
  the confidential-info confirmation.
- **Breaking changes**: if the PR is breaking, the title must use `!` (e.g. `feat(catalog)!: …`).

## Filled example

```markdown
**Description:**

Add a star toggle and equal-height cards to the model catalog so users can favorite agents directly
from the grid. Favorites now sort to the top and the toggle reflects state without a full reload.

Issues:

- Issue #7432

**UI changes**

See Figma: https://figma.com/file/… (catalog card + star states)

**Checklist:**

- [x] the pull request name complies with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [x] the pull request name starts with `feat(catalog):`
- [x] the pull request name ends with `(Issue #7432)`
- [x] I confirm that do not share any confidential information like API keys or any other secrets and private URLs
```

## Creating the PR

```bash
# Regular PR
gh pr create \
  --base development-1.0 \
  --head <type>/<short-slug> \
  --title "<type>(<area>): <description> (Issue #<ticket>)" \
  --body "<generated body>"

# Draft PR (if the user said "draft")
gh pr create \
  --base development-1.0 \
  --head <type>/<short-slug> \
  --title "<type>(<area>): <description> (Issue #<ticket>)" \
  --body "<generated body>" \
  --draft
```

If `gh` is unavailable, give the compare URL for manual PR creation:

```
https://github.com/epam/ai-dial-chat/compare/development-1.0...<type>/<short-slug>
```
