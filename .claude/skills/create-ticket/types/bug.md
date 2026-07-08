# Bug

Type label: `bug`. A severity label (`Severity-*`) comes from the Severity question below. See `../labels.md`.

## Fields to gather (Step 3)

Ask each as a separate question via **AskUserQuestion** (open-ended unless a choice is specified). Skip any field already covered by the approved Step 2 draft.

1. **Version**: Auto-detect by reading the `version` field from the root `package.json`. Confirm with user:
   > "The current version is `<version>`. Is this the version where you see the bug?"
2. **Steps to reproduce**: Ask:
   > "How do you reproduce this bug? Provide step-by-step instructions."
3. **Actual result**: Ask:
   > "What happens currently? (the broken behavior)"
4. **Expected result**: Ask:
   > "What should happen instead?"
5. **Additional information** (optional): Ask:
   > "Any additional context? (screenshots, logs, browser info — or skip)"
6. **Severity**: Use **AskUserQuestion** with options:
   - **Critical** — Severe issue impacting core functionality, requires urgent resolution
   - **Major** — Affects many users or key components
   - **Minor** — Minor issue with limited impact
   - **Low** — Low issue with little to no critical impact

## Body format (Step 8)

```markdown
### EPAM AI DIAL Admin version

<version>

### How to reproduce

<steps>

### Actual result

<actual>

### Expected result

<expected>

### Additional information

<info or "_No response_">

### Details

<details-section>

### Confidential information

- [x] I confirm that do not share any confidential information
```
