## ADDED Requirements

### Requirement: Shared default deployment version
`@epam/ai-dial-builder-form` SHALL export `DEFAULT_DEPLOYMENT_VERSION`, the string `'1.0.0'`, from `libs/builder-form/src/index.ts`, defined next to `SEMVER_VERSION_PATTERN` in `libs/builder-form/src/utils/validate-deployment-creation-fields.ts`. It is the single frontend source for the Version value a deployment create form opens with, and it SHALL satisfy `SEMVER_VERSION_PATTERN`. The library SHALL NOT apply it on its own: `useMetadataForm`, `MetadataForm` and `validateDeploymentCreationFields` keep using the values the host passes, and a host opts in by seeding its create-mode values with the constant.

#### Scenario: Constant is exported and SemVer-valid
- **WHEN** a consumer writes `import { DEFAULT_DEPLOYMENT_VERSION, SEMVER_VERSION_PATTERN } from '@epam/ai-dial-builder-form'`
- **THEN** `DEFAULT_DEPLOYMENT_VERSION` equals `'1.0.0'` and `validateDeploymentCreationFields` with `validateVersionPattern: SEMVER_VERSION_PATTERN` returns no version error for it

#### Scenario: The library does not inject the default
- **WHEN** `useMetadataForm` is seeded with `version: ''`
- **THEN** the Version field renders empty; the library does not substitute `DEFAULT_DEPLOYMENT_VERSION`
