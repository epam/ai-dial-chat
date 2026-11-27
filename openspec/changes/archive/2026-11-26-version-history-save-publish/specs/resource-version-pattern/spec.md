# Spec Delta

## Purpose

Defines the single rule that decides whether a resource version string is acceptable, so every UI input and every API write path for applications, toolsets and publish targets accepts and rejects exactly the same versions.

## ADDED Requirements

### Requirement: A version that creates a path is validated by the strict rule

A resource version SHALL be a free string, not semver. A version that creates a path (a new application or toolset, a fork, "Save as new version") SHALL be accepted only when it matches `^(?!.*\.$)(?!.*__)(?!_)[\w.+-]{1,64}$`: one to 64 characters from letters, digits, underscore, dot, plus and hyphen, not ending with a dot, not containing `__` and not starting with `_`. This is the publish-target rule `^(?!\.+$)[\w.+-]{1,64}$` plus three exclusions, each with its own reason, and the code comments on both constants repeat them:

- a trailing dot is rejected (it also rejects versions made only of dots) because the version ends the last segment of the stored path (`{name}__{version}`) and DIAL Core answers `400` for a path whose last segment ends with `.`;
- `__` and a leading `_` are rejected because `__` is the separator between the name and the version in that path (the issue and `RESOURCE_VERSION_SEPARATOR` in `apps/chat-api/src/common/utils/next-free-path.ts` define it) and every reader splits the path at its last `__`, so a version such as `1__2` would move part of itself into the name (`App__1__2` would be read as name `App__1`, version `2`), and a version such as `_1` would be indistinguishable from a name ending with `_` (`App___1`), splitting the versions of one resource into different groups. There SHALL be no ordering between versions and no "greater than the previous version" check anywhere. The default version of a new resource stays `1.0.0` (`DEFAULT_RESOURCE_VERSION` in `apps/chat-api/src/common/utils/resource-identity.ts`).

The strict rule SHALL apply to a version a request supplies in: the create and fork-version bodies of applications, the create body of toolsets, and the UI inputs that introduce a version (the Save panel's new-version input and the Version field of the create form of the Quick App, schema app, custom app and toolset editors). A stored version is never re-validated on read.

#### Scenario: Text version is accepted everywhere
- **WHEN** a user saves an application or a toolset as new version `beta-2`
- **THEN** the UI shows no format error, the API accepts the request, and the publish of that version is accepted

#### Scenario: Plus sign is accepted for applications
- **WHEN** an application is created or forked with version `1.0+build5`
- **THEN** the API accepts it and the stored path encodes the plus sign

#### Scenario: A resource id carrying a plus sign is accepted
- **WHEN** an endpoint receives an application or toolset id whose version has a plus sign, raw (`my-app__1.0+build5`, as DIAL Core emits it) or percent-encoded (`my-app__1.0%2Bbuild5`)
- **THEN** the id validators (`DEPLOYMENT_ID_PATTERN`, `isSafeResourceId`, `isSafeDeploymentId`) accept it; traversal segments stay rejected

#### Scenario: Over-long new version is rejected
- **WHEN** a version of 65 characters is supplied to a request or UI input that creates a path
- **THEN** the UI shows the invalid-version error and the API answers `400`; a 64-character version is accepted

#### Scenario: Trailing dot is rejected for a new version
- **WHEN** the version of a request that creates a path is `1.0.` or `1.`, or any request carries `..`
- **THEN** the UI shows the invalid-version error and the API answers `400`

#### Scenario: The name separator is rejected for a new version
- **WHEN** the version of a request that creates a path contains `__` (for example `1__2`) or starts with `_` (for example `_1`)
- **THEN** the UI shows the invalid-version error and the API answers `400`; a version with a single inner or trailing underscore (`1_0`, `v1_`) is accepted, and an update or a publish of a stored version with these characters is accepted (see the stored rule)

#### Scenario: Forbidden characters are rejected
- **WHEN** the version contains a space, `/` or `:`
- **THEN** the UI shows the invalid-version error and the API answers `400`

#### Scenario: A stored version longer than 64 characters is saved unchanged
- **WHEN** an application whose stored version is longer than 64 characters is saved from its editor without changing the version
- **THEN** the editor shows no version error and the update request is accepted

### Requirement: A stored version keeps the earlier, looser rule

A version that already exists, or that does not create a path, SHALL be accepted when it matches `^(?!\.+$)[\w.+-]+$` (`STORED_RESOURCE_VERSION_PATTERN`; letters, digits, underscore, dot, plus and hyphen, not made of dots only, with no length limit because the earlier application rule had none). This rule applies to the update bodies of applications and toolsets (an update rewrites only `displayVersion` and the stored path keeps the version the resource was created with, so the version never reaches the path), to the publish version (the publish resends the stored version), and to the version field of the edit form of every application and toolset editor. A version stored under the earlier rules, such as `_beta`, `1__2` or an application version longer than 64 characters, therefore still saves unchanged and publishes (a publish target name carries at most 64 characters of version; a longer one publishes under the source name, as before). The publish DTO now rejects a version outside the stored rule (for example one with a space or a non-ASCII character) with `400`; before this change it only checked that the field was a string. It is mirrored as `STORED_RESOURCE_VERSION_PATTERN` in `@epam/ai-dial-chat-shared` and covered by the same corpus and parity spec. Every version the strict rule accepts is accepted by this one.

#### Scenario: A stored version outside the strict rule is saved unchanged
- **WHEN** a toolset stored with version `_beta` (or `1__2`, or `1.0.`) is saved from its editor without changing the version
- **THEN** the editor shows no version error and the update request is accepted

#### Scenario: A stored version outside the strict rule is published
- **WHEN** an application or toolset stored with version `_beta` or `1__2` is published
- **THEN** the publish request is accepted

### Requirement: The UI never accepts a version the API rejects

For every string, the UI's version check and the API's version check SHALL give the same verdict. `apps/chat-api` is a `type:backend` project and may depend only on `type:backend` libraries, so the rule SHALL be kept as two mirrored constants, one in `apps/chat-api` and one in `@epam/ai-dial-chat-shared`, each commented as the mirror of the other, in the same way as the entity field limits. The API holds the only corpus of accepted and rejected strings for both rules; the spec of the `@epam/ai-dial-chat-shared` constant reads the API pattern file and the API corpus file, compares the two regular expressions and runs the same corpus, so the two cannot drift. No other copy of the pattern SHALL exist in either surface. A version that passes the UI check SHALL NOT be answered with a validation `400` for its format.

#### Scenario: Same verdict for the same string
- **WHEN** each string of the API corpus is checked by the UI constant and by the API constant
- **THEN** both give the same verdict, and a test fails if the two regular expressions or their verdicts differ

#### Scenario: No leftover copies
- **WHEN** the source of the API DTOs, the publish target and the UI editors is searched for a version pattern
- **THEN** each uses the mirrored constant of its own surface (the strict one where a path is created, the stored one for an update and a publish)

### Requirement: Invalid-version responses name the rule

An API validation failure for a version SHALL answer `400` with a message that states the allowed characters (letters, digits, underscore, dot, plus, hyphen), the 64-character maximum, that a version cannot end with a dot, and that it cannot contain two underscores in a row or start with an underscore. The three application DTOs, the toolset DTO and the publish target SHALL share the same message.

#### Scenario: Message is the same across endpoints
- **WHEN** an invalid version is sent to create-application, update-application, fork-version, create-toolset, update-toolset and publish
- **THEN** each answers `400` with the same version message
