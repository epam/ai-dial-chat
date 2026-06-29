---
name: link-workspace-packages
description: 'Link workspace packages in monorepos (npm, yarn). USE WHEN: (1) you just created or generated new packages and need to wire up their dependencies, (2) user imports from a sibling package and needs to add it as a dependency, (3) you get resolution errors for workspace packages (@epam/*) like "cannot find module", "failed to resolve import", "TS2307", or "cannot resolve". DO NOT patch around with tsconfig paths or manual package.json edits - use the package manager''s workspace commands to fix actual linking.'
---

# Link Workspace Packages

Add dependencies between packages in a monorepo. All package managers support workspaces but with different syntax.

## Detect Package Manager

Check whether there's a `packageManager` field in the root-level `package.json`.

Alternatively check lockfile in repo root:

- `yarn.lock` → yarn
- `package-lock.json` → npm

## Workflow

1. Identify consumer package (the one importing)
2. Identify provider package(s) (being imported)
3. Add dependency using package manager's workspace syntax
4. Verify symlinks created in consumer's `node_modules/`

---

## yarn (v2+/berry)

Also uses `workspace:` protocol.

```bash
yarn workspace @epam/app add @epam/ui
```

Result in `package.json`:

```json
{ "dependencies": { "@epam/ui": "workspace:^" } }
```

---

## npm

No `workspace:` protocol. npm auto-symlinks workspace packages.

```bash
npm install @epam/ui --workspace @epam/app
```

Result in `package.json`:

```json
{ "dependencies": { "@epam/ui": "*" } }
```

npm resolves to local workspace automatically during install.

---

## Examples

**Example 1: npm - link ui lib to app**

```bash
npm install @epam/ui --workspace @epam/app
```

**Example 2: npm - link multiple packages**

```bash
npm install @epam/data-access @epam/ui --workspace @epam/dashboard
```

**Example 3: Debug "Cannot find module"**

1. Check if dependency is declared in consumer's `package.json`
2. If not, add it using appropriate command above
3. Run install (`npm install`)

## Notes

- Symlinks appear in `<consumer>/node_modules/@epam/<package>`
- **Hoisting differs by manager:**
  - npm: hoists shared deps to root `node_modules`
  - yarn berry: uses Plug'n'Play by default (no `node_modules`)
- Root `package.json` should have `"private": true` to prevent accidental publish
