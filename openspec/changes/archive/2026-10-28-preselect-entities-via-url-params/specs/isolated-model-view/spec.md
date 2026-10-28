# Spec Delta

## ADDED Requirements

### Requirement: deployment-id is the non-isolating replacement and isolated view takes precedence

The temporary `isolated-model-id` parameter (`TODO: remove in next release.`) is superseded for preselection by `deployment-id`, which selects a deployment without isolating the view (see the `url-entity-preselection` capability). The two parameters are independent: `IsolatedModelViewContext` SHALL keep reading only `isolated-model-id`, and `deployment-id` SHALL NOT activate isolated view or apply the isolated UI-feature override.

When both are present on `/`, isolated view SHALL win: the pinned deployment is selected by the isolated branch, and the URL preselection does nothing — `deployment-id` is neither applied nor reported through any notification (including for an unknown id), and every URL parameter is left in the URL. Because isolated view disables the `skills` and `prompts` UI features, `skill-id` and `prompt-id` are likewise ignored while it is active. This combination is unsupported and exists only until isolated view is removed.

#### Scenario: deployment-id does not activate isolated view

- **WHEN** the URL is `/?deployment-id=<id>` without `isolated-model-id`
- **THEN** `useIsolatedModelView()` returns `{ isActive: false, isNotFound: false, resolvedDeploymentId: null }` and navigation and agent picker stay visible

#### Scenario: Both parameters present with a known deployment-id

- **WHEN** the URL is `/?isolated-model-id=a&deployment-id=b` and both name known deployments
- **THEN** deployment `a` is selected in isolated view and `b` is ignored
- **AND** the URL is left as it is

#### Scenario: Both parameters present with an unknown deployment-id

- **WHEN** the URL is `/?isolated-model-id=a&deployment-id=missing`
- **THEN** deployment `a` is selected and no "deployment not found" notification is shown
