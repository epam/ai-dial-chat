# Spec Delta

## Purpose

Defines the single rule that decides whether a resource version string is acceptable, so every UI input and every API write path for applications, toolsets and publish targets accepts and rejects exactly the same versions.

## ADDED Requirements

### Requirement: A version is a free string validated by one rule

A resource version SHALL be a free string, not semver. It SHALL be accepted only when it matches `^(?!.*\.$)[\w.+-]{1,64}$`: one to 64 characters from letters, digits, underscore, dot, plus and hyphen, not ending with a dot. This is the publish-target rule `^(?!\.+$)[\w.+-]{1,64}$` plus a ban on a trailing dot, which also rejects versions made only of dots. A trailing dot is rejected because the version ends the last segment of the stored path (`{name}__{version}`) and DIAL Core answers `400` for a path whose last segment ends with `.`. There SHALL be no ordering between versions and no "greater than the previous version" check anywhere. The default version of a new resource stays `1.0.0` (`DEFAULT_RESOURCE_VERSION` in `apps/chat-api/src/common/utils/resource-identity.ts`).

The rule SHALL apply to a version the caller supplies in: the create, update and fork-version bodies of applications; the create and update bodies of toolsets; the publish target version; and every UI input that edits a version (the Save panel's new-version input and the Version field of the Quick App, schema app, custom app and toolset editors). A stored version is never re-validated on read; the rule applies only to a version a request supplies.

#### Scenario: Text version is accepted everywhere
- **WHEN** a user saves an application or a toolset as new version `beta-2`
- **THEN** the UI shows no format error, the API accepts the request, and the publish of that version is accepted

#### Scenario: Plus sign is accepted for applications
- **WHEN** an application is created or forked with version `1.0+build5`
- **THEN** the API accepts it and the stored path encodes the plus sign

#### Scenario: A resource id carrying a plus sign is accepted
- **WHEN** an endpoint receives an application or toolset id whose version has a plus sign, raw (`my-app__1.0+build5`, as DIAL Core emits it) or percent-encoded (`my-app__1.0%2Bbuild5`)
- **THEN** the id validators (`DEPLOYMENT_ID_PATTERN`, `isSafeResourceId`, `isSafeDeploymentId`) accept it; traversal segments stay rejected

#### Scenario: Over-long version is rejected
- **WHEN** a version of 65 characters is supplied to any write path or UI input
- **THEN** the UI shows the invalid-version error and the API answers `400`; a 64-character version is accepted

#### Scenario: Trailing dot is rejected
- **WHEN** the version is `1.0.`, `1.` or `..`
- **THEN** the UI shows the invalid-version error and the API answers `400`

#### Scenario: Forbidden characters are rejected
- **WHEN** the version contains a space, `/` or `:`
- **THEN** the UI shows the invalid-version error and the API answers `400`

#### Scenario: A stored version outside the rule is not rewritten
- **WHEN** an update request for an application whose stored version is longer than 64 characters omits `version`
- **THEN** the update succeeds and the stored version is unchanged

### Requirement: The UI never accepts a version the API rejects

For every string, the UI's version check and the API's version check SHALL give the same verdict. `apps/chat-api` is a `type:backend` project and may depend only on `type:backend` libraries, so the rule SHALL be kept as two mirrored constants, one in `apps/chat-api` and one in `@epam/ai-dial-chat-shared`, each commented as the mirror of the other, in the same way as the entity field limits. Both constants SHALL be tested against one shared corpus of accepted and rejected strings, so the two cannot drift. No other copy of the pattern SHALL exist in either surface. A version that passes the UI check SHALL NOT be answered with a validation `400` for its format.

#### Scenario: Same verdict for the same string
- **WHEN** each string of the corpus is checked by the UI constant and by the API constant
- **THEN** both give the same verdict, and a test fails if they differ

#### Scenario: No leftover copies
- **WHEN** the source of the API DTOs, the publish target and the UI editors is searched for a version pattern
- **THEN** each uses the mirrored constant of its own surface

### Requirement: Invalid-version responses name the rule

An API validation failure for a version SHALL answer `400` with a message that states the allowed characters (letters, digits, underscore, dot, plus, hyphen), the 64-character maximum and that a version cannot end with a dot. The three application DTOs, the toolset DTO and the publish target SHALL share the same message.

#### Scenario: Message is the same across endpoints
- **WHEN** an invalid version is sent to create-application, update-application, fork-version, create-toolset, update-toolset and publish
- **THEN** each answers `400` with the same version message
