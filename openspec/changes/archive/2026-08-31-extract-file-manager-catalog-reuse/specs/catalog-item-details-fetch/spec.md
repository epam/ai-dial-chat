## MODIFIED Requirements

### Requirement: `CatalogView` wires `onFetchDetails` to the new backend endpoint

`CatalogView` SHALL create a stable app-level `CatalogDetailsApi` adapter from
the existing `apps/chat/src/server-api` wrappers, pass it with resolved labels,
configuration and skill metadata to `useCatalogItemDetails` from
`@epam/ai-dial-chat-hooks`, and pass the returned stable `onFetchDetails`
callback to `Catalog`. It SHALL NOT retain the entity dispatch/mapping algorithm
inline or add direct `fetch`/client construction.

**Deployment-backed items (`Model`, `Agent`, `Toolset`).** The controller SHALL
call the injected deployment-details operation and reuse the current
`mapDeploymentDetailsDtoToEntityDetails` and
`mapEntityDetailsToCatalogDetails` pipeline. It SHALL preserve DTO-discriminator
mapping, application MCP/connect endpoint precedence, credentials, admin-only
data and all currently rendered sections. Models alone SHALL request limits in
parallel and reuse the current `chat-hooks` deployment-limits mapper; a limits
failure SHALL not hide otherwise successful details.

**Prompts.** The controller SHALL branch before deployments and call the
injected public operation for organisation prompts, personal operation for
personal prompts, or the personal/shared operation with parsed owner bucket for
qualified shared ids. Because fetched data replaces static details wholesale,
the result SHALL contain both prompt content and the rebuilt overview. Prompt
failure SHALL resolve `undefined` to preserve seeded list content. Prompts SHALL
not call deployment operations.

**Skills.** The controller SHALL parse `{ bucket, path }` from the qualified id,
store it only in a private ref for subsequent file loads, and execute manifest
download and recursive file listing with `Promise.allSettled`. Each half SHALL
be independently optional; both failures or an invalid id resolve `undefined`,
and invalid ids issue no request. A downloaded but unparseable manifest SHALL
return raw text rather than fail. Skills SHALL not call deployment operations.

All callbacks SHALL be `useCallback`-stable for stable inputs. Rejected details
operations SHALL resolve `undefined` and SHALL NOT log or throw beyond the
configured client's existing behavior.

#### Scenario: Successful model fetch renders structured tabs

- **WHEN** model details resolve with the model DTO discriminator
- **THEN** the controller returns mapped Overview/Pricing/API data

#### Scenario: Model limits render the Limits tab

- **WHEN** model limits contain a usable stats field
- **THEN** the existing hook-layer mapper supplies `details.limits`

#### Scenario: Model limits failure preserves other details

- **WHEN** details resolve and limits reject
- **THEN** details return without limits

#### Scenario: Unlimited limits remain accessible

- **WHEN** DIAL Core returns its effectively unlimited total
- **THEN** the existing mapper preserves numeric progress and resolved unlimited
  visible/accessibility labels

#### Scenario: Toolset details preserve credentials

- **WHEN** toolset details resolve with authentication settings
- **THEN** the mapped overview and credential/admin data match current behavior

#### Scenario: Application endpoint precedence is unchanged

- **WHEN** application details contain MCP and connect interface data
- **THEN** the same current MCP/connect endpoint and credential precedence is
  returned

#### Scenario: Backend error does not crash the panel

- **WHEN** a deployment detail operation rejects
- **THEN** `onFetchDetails` resolves `undefined` and Catalog falls back to its
  static details

#### Scenario: All deployment types use the same operation

- **WHEN** a Model, Agent, or Toolset is opened
- **THEN** the injected deployment-details operation is used, and only Model
  also requests limits

#### Scenario: Personal prompt renders content and overview

- **WHEN** a personal prompt is opened
- **THEN** the personal operation receives `item.id` and the returned fetched
  data includes Content and rebuilt Overview

#### Scenario: Organisation prompt uses the public operation

- **WHEN** an organisation prompt is opened
- **THEN** only the public prompt operation is used

#### Scenario: Shared prompt preserves owner bucket

- **WHEN** `prompts/owner-bucket/Work/summarize` is opened
- **THEN** the shared read receives `('Work/summarize', 'owner-bucket')`

#### Scenario: Prompt never reaches deployments

- **WHEN** a Prompt is opened
- **THEN** neither deployment details nor limits is requested

#### Scenario: Prompt failure degrades to seeded content

- **WHEN** prompt refresh rejects and list mapping seeded content
- **THEN** the callback resolves `undefined` and seeded content remains

#### Scenario: Skill details combine manifest and inventory

- **WHEN** manifest download and recursive listing both resolve
- **THEN** returned data contains manifest content/specification and overview
  inventory matching current mapping

#### Scenario: Skill partial failure returns the successful half

- **WHEN** one of manifest or inventory rejects
- **THEN** the other half is returned without throwing

#### Scenario: Unparseable manifest renders raw text

- **WHEN** manifest download succeeds but parsing fails
- **THEN** raw manifest text remains Content without summary/specification

#### Scenario: Invalid skill id issues no request

- **WHEN** a skill id cannot be parsed
- **THEN** the callback resolves `undefined` without invoking a skill operation
