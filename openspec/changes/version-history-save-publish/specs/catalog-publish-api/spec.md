# Spec Delta

## ADDED Requirements

### Requirement: Publish and unpublish also clear the version statuses publications cache

Wherever publishing and unpublishing clear the `publish-history` cache entry of an entity, they SHALL also clear the caller's `publish:bucket-publications:{bucket}` entry used by the version statuses endpoint (`catalog-version-statuses-api`), so a status read after a publish or unpublish never serves the previous publications. The `publish-history` behavior, its key and its output SHALL be unchanged, and the detail resolution it shares with the statuses service SHALL return the same entries as before for every input.

#### Scenario: Publish clears both entries
- **WHEN** an application version is published
- **THEN** both the `publish-history` entry of that entity and the bucket's publications entry are cleared

#### Scenario: Unpublish clears both entries
- **WHEN** a published version is unpublished
- **THEN** both entries are cleared

#### Scenario: publish-history output is unchanged
- **WHEN** `publish-history` is requested for any entity after the shared detail resolution was split
- **THEN** its entries are identical to those returned before the split
