/**
 * SemVer 2.0.0 version (https://semver.org): `MAJOR.MINOR.PATCH` without
 * leading zeros, with an optional pre-release (`-beta.1`) and build metadata
 * (`+build.5`). DIAL Admin validates application and toolset versions with
 * `semver.valid()`, so a version stored through chat stays editable there.
 * The chat frontend mirrors this regex as `SEMVER_VERSION_PATTERN` in
 * `@epam/ai-dial-builder-form` so it can reject a bad value inline.
 */
export const SEMVER_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

export const SEMVER_VERSION_VALIDATION_MESSAGE =
  'version must follow semantic versioning (e.g. 1.0.0)';
