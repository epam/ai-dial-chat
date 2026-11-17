# Spec Delta

## Purpose

Publishing an application also publishes the private resources it refers to, so the published application works for the people it is shared with. This capability defines which dependencies are published, where they land, how the application is made to refer to them, and what the author's original is guaranteed to look like afterwards.

## ADDED Requirements

### Requirement: Publishing an application publishes its first-level private dependencies in the same request

When an application is published through `POST /api/v1/catalog/applications/:entityId/publish` and its publish dependencies (see `publish-dependencies-api`) are not empty, the backend SHALL submit **one** DIAL Core publication request whose resources are the application and one `ADD` resource per dependency that needs publishing, so that Core approves or rejects them together. Only the direct references of the application are published; a dependency's own references SHALL NOT be resolved or published. Only dependencies in the caller's own bucket are published: a dependency in another user's bucket SHALL be left as it is, neither added to the request nor rewritten, as the files of a conversation in another user's bucket are.

The request, its path parameters, its body (`folderPath`, `version`, `rules`, `publishCredentials`), its success response and every existing error response SHALL NOT change shape. An application without private dependencies SHALL produce exactly the Core request it produced before this change. Other entity types (toolset, prompt, skill, project) and conversations SHALL be unaffected.

Dependencies SHALL be submitted with `publishCredentials` unset, whatever the request's `publishCredentials` says for the application. A dependency of type `file` SHALL get neither an `ADD` resource nor a rewritten reference: DIAL Core copies and relinks file references itself when it copies the application.

#### Scenario: Application with private skills publishes them with it
- **GIVEN** an application whose schema marks two private skills as `dial:resource`
- **WHEN** the owner publishes it to `Organization/Agents`
- **THEN** one Core publication is created with three `ADD` resources: the application and the two skills

#### Scenario: Dependency in another user's bucket is left alone
- **GIVEN** an application refers to a private skill in the caller's bucket and to a private skill in a colleague's bucket
- **WHEN** the application is published
- **THEN** only the caller's skill is added and rewritten, and the reference to the colleague's skill is unchanged

#### Scenario: Application without dependencies is unchanged
- **GIVEN** an application with no private references
- **WHEN** it is published
- **THEN** the Core request is identical to the request sent before this change

#### Scenario: Second-level dependency is not published
- **GIVEN** a private application the published application uses references a private skill itself
- **WHEN** the published application is published
- **THEN** the request contains the dependency application and not its skill

#### Scenario: Publish credentials are not carried to dependencies
- **GIVEN** a private toolset dependency and `publishCredentials: true` in the request
- **WHEN** the application is published
- **THEN** the toolset resource carries no `publishCredentials` flag

#### Scenario: File reference is left to Core
- **GIVEN** a `dial:resource` value that is a private file
- **WHEN** the application is published
- **THEN** no `ADD` resource is created for the file and its reference is not rewritten by the backend

#### Scenario: Another entity type is unchanged
- **WHEN** a prompt is published
- **THEN** the request contains only the prompt, exactly as before

### Requirement: Dependencies are published into a per-application namespace

The `targetUrl` of a dependency SHALL be `{type}/public/{folderPath}/.{applicationResourceName}.deps/{sourceBucket}/{path of the dependency relative to its bucket}`, where `{type}` is its resource type prefix (`applications`, `toolsets`, `prompts`, `skills`), `{folderPath}` is the publish target folder, and `{applicationResourceName}` is the last segment of the published application's own `targetUrl`. The namespace is a **sibling** of the published application, never nested under its name, so a dependency that is itself an application cannot share a path with the application. The source bucket is a path segment of its own, so two authors' same-named dependencies never collide and a published copy can only be matched with the bucket it came from. Path segments of the dependency SHALL be carried over unchanged, including a `__version` suffix. The namespace SHALL be derived by one shared function.

The `targetUrl` of the application itself SHALL be the one it would have had without this change.

#### Scenario: Prompt in a folder keeps its structure
- **GIVEN** a dependency `prompts/bucket-123/Support/Greeting` and an application published to `Organization/Agents` as `Helper__1.0.0`
- **THEN** the prompt's `targetUrl` is `prompts/public/Organization/Agents/.Helper__1.0.0.deps/bucket-123/Support/Greeting`

#### Scenario: Dependency application does not collide with the application
- **GIVEN** a dependency `applications/bucket-123/Calculator__1.0.0` and an application published as `Helper__1.0.0`
- **THEN** the dependency's `targetUrl` is `applications/public/Organization/Agents/.Helper__1.0.0.deps/bucket-123/Calculator__1.0.0`, a sibling of `applications/public/Organization/Agents/Helper__1.0.0`

#### Scenario: Versioned toolset keeps its version suffix
- **GIVEN** a dependency `toolsets/bucket-123/Search__1.0.0`
- **THEN** its published leaf is `Search__1.0.0`

#### Scenario: Two authors with the same dependency name
- **GIVEN** two authors each depend on a skill called `Docs helper`
- **WHEN** both applications are published to the same folder under different names
- **THEN** both publishes succeed and the skills are stored under different namespaces

### Requirement: A dependency already published at its target is reused

Before the request is built, the backend SHALL check, with the caller's token, whether each dependency's `targetUrl` already exists. A dependency whose target exists SHALL NOT be added to the request, and the published application SHALL still refer to that target. This is what makes publishing the same application version again after it was unpublished work: unpublishing removes only the application, so the dependencies of an earlier publish are still there. A dependency whose target does not exist is published as usual. The existing target's content is not refreshed: a dependency changed since it was published is not published again for the same application version, and publishing a new version creates a new namespace and publishes the dependencies again.

Unpublishing an application SHALL NOT change: it removes the application only, exactly as before this change, for applications published with or without dependencies.

#### Scenario: Republish after unpublish succeeds
- **GIVEN** an application was published with a skill dependency, then unpublished
- **WHEN** the same version is published again to the same folder
- **THEN** the request contains the application only, its reference points to the existing published skill, and the publish succeeds

#### Scenario: New version publishes dependencies again
- **GIVEN** version `1.0.0` was published with a prompt dependency
- **WHEN** version `1.1.0` is published to the same folder
- **THEN** the prompt is added to the request under the namespace of `Helper__1.1.0`

#### Scenario: Unpublish is unchanged
- **WHEN** an application published with dependencies is unpublished
- **THEN** the Core removal request lists the application only

### Requirement: The published application refers to the published dependencies

For every dependency that is published with the application or reused, each value the application's own schema marks `dial:resource` that equals the dependency's resource URL (compared after percent-decoding, so a value carrying a `?query`, `#fragment` or a legacy `metadata/` prefix still matches) SHALL be replaced, in the copy of the application that Core publishes, by that dependency's `targetUrl` in the same percent-encoded form Core receives in the request. No other value SHALL change.

The author's own application SHALL NOT be modified at any point: its stored body SHALL be identical before and after the publish, whether the request succeeds, is rejected by an approver, or fails.

#### Scenario: References point to the published copies
- **GIVEN** an application referring to `skills/bucket-123/Docs%20helper` and a request that publishes that skill to `skills/public/Org/.Helper__1.0.0.deps/bucket-123/Docs%20helper`
- **WHEN** the request is approved
- **THEN** the published application refers to the published skill and a second user can use it without access to the author's bucket

#### Scenario: Rejection leaves the original intact
- **WHEN** an approver rejects the request
- **THEN** the original application is byte-identical to what it was before publishing and still refers to its private dependencies

#### Scenario: Unrelated values are not touched
- **GIVEN** a string property that happens to contain text equal to no dependency
- **THEN** it is unchanged in the published copy

#### Scenario: Reference carrying a fragment still matches
- **GIVEN** a value `prompts/bucket-123/Greeting#v2` whose dependency id is `prompts/bucket-123/Greeting`
- **THEN** the value is replaced

### Requirement: The source Core receives is a temporary copy that lives only for the publication call

The backend SHALL give Core, as the application's `sourceUrl`, a temporary copy of the application created in the caller's own bucket with DIAL Core's copy operation, then rewritten as described above. The copy SHALL be created at a staging path derived from the original's path, so that one application has at most one copy in flight; a second publish of the same application while a copy exists SHALL be answered `409`, unless that copy was last modified more than 3 minutes ago: such a copy is a leftover of an interrupted publish, and the new publish SHALL delete it and continue.

The copy SHALL be deleted as soon as the Core call returns, on success and on every failure, including a failure while preparing it. A copy SHALL NOT be read by anyone but its author, SHALL NOT appear in the public catalog, and the backend SHALL clear the caller's cached application lists after creating and after deleting it. A failed deletion SHALL be logged as a warning with the copy's id and SHALL NOT fail a publish whose Core call succeeded.

Because Core copies sources into its review bucket while the request is created and uses only the review copies afterwards, the copy SHALL NOT be needed after the Core call returns, and approval, rejection and unpublishing SHALL NOT depend on it.

#### Scenario: Copy is removed after success
- **WHEN** the Core call succeeds
- **THEN** the temporary copy no longer exists once the publish response is returned

#### Scenario: Copy is removed after a Core error
- **WHEN** Core answers 403 to the publication request
- **THEN** the temporary copy is deleted and the original error response is returned

#### Scenario: Concurrent publish of the same application
- **GIVEN** a temporary copy of the application exists
- **WHEN** the same application is published again
- **THEN** the second request is answered `409` and the first is not affected

#### Scenario: A leftover copy is reclaimed
- **GIVEN** a temporary copy of the application was last modified 4 minutes ago
- **WHEN** the application is published
- **THEN** the old copy is deleted, a new one is made and the publish proceeds

#### Scenario: A recent copy is not reclaimed
- **GIVEN** a temporary copy of the application was last modified 1 minute ago
- **WHEN** the application is published
- **THEN** the response is `409` and the existing copy is left alone

#### Scenario: Failed cleanup does not fail the publish
- **GIVEN** the Core call succeeded and deleting the copy fails
- **THEN** the publish still succeeds, and a warning naming the copy is logged without any token

### Requirement: A failure preparing the dependencies falls back to the unchanged publish

Any failure while the backend prepares an application's dependencies for publishing SHALL NOT fail the publish: reading the application or its schema, resolving its references, finding out whether a dependency target exists (a DIAL Core answer other than found or not found), and creating or writing the temporary copy, including a refusal from DIAL Core (for example for an application with interceptors written by a non-administrator). The backend SHALL log a warning naming the application and the reason, without tokens or bodies, delete any temporary copy it made, and publish the application exactly as it was published before this change, that is without its dependencies. The one exception is "the same application is already being published", which stays a `409`; a conflict while saving the copy is an ordinary preparation failure and falls back. A failure of DIAL Core's own `createPublication` is reported as before. An application that is not in the caller's own bucket takes the unchanged path without a warning. The read-only `GET /api/v1/catalog/:entityType/:entityId/publish-dependencies` endpoint keeps its best-effort behaviour.

#### Scenario: Schema fetch fails
- **GIVEN** the application's schema cannot be fetched
- **WHEN** the application is published
- **THEN** the application is published without dependencies, as before, no copy is created and a warning is logged

#### Scenario: Application with interceptors written by a non-administrator
- **GIVEN** an application with interceptors and a caller who is not an administrator
- **WHEN** the copy is written and Core answers 403
- **THEN** the temporary copy is deleted and the application is published without dependencies, as before

#### Scenario: Core cannot tell whether a dependency target exists
- **GIVEN** DIAL Core answers 503 when the dependency target is looked up
- **WHEN** the application is published
- **THEN** the application is published without dependencies, as before, and no copy is created

#### Scenario: Dependency was deleted
- **GIVEN** a dependency listed by the resolver no longer exists when the request is created
- **WHEN** DIAL Core refuses the request
- **THEN** the response carries Core's error, the temporary copy is deleted and no publication exists

#### Scenario: Another user's application
- **GIVEN** the application is in another bucket
- **WHEN** it is published
- **THEN** it is published as before, with no copy and no warning

#### Scenario: Rejected request, then the same version again
- **GIVEN** an application was published with dependencies and an approver rejected the request
- **WHEN** the same version is published again to the same folder
- **THEN** the new request carries the application and its dependencies again and no temporary copy remains

#### Scenario: Preview endpoint stays best-effort
- **GIVEN** the same schema failure
- **WHEN** `GET .../publish-dependencies` is requested
- **THEN** it answers `200` with an empty list

### Requirement: The original keeps its publication status, history and Unpublish access

A publication whose application resource names the temporary copy SHALL be treated as a publication of the original everywhere the backend matches a publication's **source** to an application: version status (Published, In review, Not published), published folders, publish history and unpublish access. The staging path SHALL be mapped back to the original by the one comparison the backend already uses for source URLs, and ONLY on the source side: a published target path that merely contains a folder with the same name as the staging folder SHALL NOT be rewritten.

Dependencies published with an application are resources of that publication: a private prompt, skill, toolset or application may therefore read as In review or Published for the same folders. This is accepted and not specially handled in this version.

#### Scenario: In review after publishing
- **WHEN** an application is published and the request is pending
- **THEN** the version's status is In review, as for an application published without dependencies

#### Scenario: Published after approval
- **WHEN** the request is approved
- **THEN** the original shows the version as Published with the target folder and the publisher

#### Scenario: Unpublish stays available
- **WHEN** the publisher asks to unpublish the application
- **THEN** unpublish access is evaluated exactly as for an application published without dependencies

#### Scenario: A real folder with the staging name in a target is not rewritten
- **GIVEN** a published target path containing a folder named like the staging folder
- **WHEN** it is compared with a target path
- **THEN** it is compared as it is

### Requirement: Publishing with dependencies is observable and not separately gated

The backend SHALL log a debug line stating the number of dependencies published with the application and the number reused, and a warning for each failed cleanup, and SHALL NOT log tokens, request bodies or application bodies. No new metric or analytics event is added. The behaviour is not behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`; it is available wherever Publish is. The existing publish-history and bucket-publications caches (`publish-history:{entityType}:{entityId}` and `publish:bucket-publications:{bucket}`) SHALL still be cleared by a successful publish, for the application and for each dependency published with it.

#### Scenario: Caches are cleared
- **WHEN** a publish with dependencies succeeds
- **THEN** the publish-history cache of the application and of each dependency, and the caller's bucket-publications cache, are cleared before the response is returned
