---
name: PR template
title: 'PR name in Conventional Commits format (Issue #<Number>)'
assignees: @me
---

**Description:**

<SHORT_DESCRIPTION>

Issues:

- Issue #<TICKET_ID>

**Related:**

List of related pull requests:

- none

**Checklist:**

- [ ] the pull request name complies with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [ ] the pull request name starts with `fix:`, `feat:`, `feature:`, `chore:`, `hotfix:` or `e2e:`
- [ ] the pull request name ends with `(Issue #<TICKET_ID>)` (comma-separated list of issues)
- [ ] unit-tests passed
- [ ] deployed on Review environment before Code review (`deploy-review` comment)
- [ ] e2e tests passed
