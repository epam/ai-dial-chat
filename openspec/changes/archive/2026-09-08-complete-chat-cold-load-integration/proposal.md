## Why

The archived cold-load optimization met its byte budgets but left AG Grid and
package-boundary work outside its scope. The locally built UI Kit now provides
modular exports and guarded Grid registration. Chat must consume those exports
without retaining heavy features through its own barrels or chunk grouping.

## What Changes

- Use public UI Kit `/grid` and `/editors` entries and externalize subpaths in
  library builds; require a compatible package version.
- Expose optional shared file-manager UI through its own entry, preserve root
  compatibility, and declare audited package side effects.
- Defer conversation publishing until opened and use automatic Vite splitting.
- Verify a freshly packed local UI Kit against the production graph and actual
  browser feature activation; record the artifact and results.
- Verify the completed UI Kit root-loader fix and keep investigation tools out
  of the delivered change.

## Impact

No host API ownership changes. File-manager callbacks, Grid props and editor
behavior remain intact. The only new UI state is an accessible loading popup
while the conversation publication panel loads.
