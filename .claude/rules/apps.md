---
paths:
  - 'apps/**/*.tsx'
  - 'apps/**/*.ts'
globs: 'apps/**/*.ts,apps/**/*.tsx'
applyTo: 'apps/**/*.ts,apps/**/*.tsx'
alwaysApply: false
---

@.claude/rules/rtl.md

# Apps component conventions

- Name the component props type/interface `Props` (not `<ComponentName>Props`).
- Declare React components in `apps/*` as `const ComponentName: FC<Props> = (props) => { ... };`.
- Do not use function declarations for React components in `apps/*` (for example, `function ComponentName(props: Props) { ... }`).
- For React components in `apps/*`, use memoized default export in this form: `export default memo(ComponentName);`.
