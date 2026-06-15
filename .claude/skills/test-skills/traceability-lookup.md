# Skill: Traceability Matrix Lookup

Read and update `.state/traceability/matrix.json` — single source of truth for requirement ↔ test case mapping.

## File format

```json
{
  "requirements": {
    "REQ-AUTH-001": {
      "title": "User authentication via email/password",
      "test_cases": ["TC-AUTH-0001", "TC-AUTH-0002"],
      "component": "auth"
    }
  },
  "test_cases": {
    "TC-AUTH-0001": {
      "title": "Successful login with valid credentials",
      "requirement": "REQ-AUTH-001",
      "package": "heartbeat",
      "component": "auth",
      "automated": true,
      "automation_path": "src/test/resources/features/auth/login.feature"
    }
  }
}
```

## Operations

| Operation | How |
|---|---|
| Lookup by requirement | Read `requirements[<id>].test_cases` |
| Lookup by test case | Read `test_cases[<id>]` |
| Coverage % | `count(test_cases where automated=true) / count(test_cases where package != 'manual')` |
| Add new TC | Insert under both `requirements[<req>].test_cases` and `test_cases[<tc>]` |
| Deprecate TC | Set `package = 'deprecated'` — never remove the entry |
| Update package on graduation | `graduation` sets `package` from `new-feature` → `heartbeat` or `regression` |

## Conventions

- Test case IDs: `TC-<COMPONENT>-<NNNN>` (e.g. `TC-AUTH-0042`).
- Requirement IDs: `REQ-<COMPONENT>-<NNNN>`. Stable identifier from the `id` frontmatter field in `strategy-core/requirements/<topic>.md`. Survives file renames.
- Never delete entries — deprecate. History is required for audits and metrics.
- All updates committed atomically with the change that caused them.
