## Why

Operators can configure project context byte limits, but a fixed 100-file cap and 64 MiB snapshot cap prevent larger projects.

## What Changes

Configure the file count and archive read budget. Publish the count through client-config and validate the final context on create and edit.

## Capabilities

### Modified Capabilities

- `app-config-context` supplies the count to both project forms.
- `client-config-endpoint` advertises the count to the browser.
- `project-create-api` enforces configurable count and size limits.
- `project-detail-api` reads snapshots under a configurable archive budget.
- `project-create-ui` validates the advertised file count.

## Impact

The shared form receives an optional resolved count and the host supplies translated feedback. Existing deployments keep their defaults. Core quotas are configured independently.
