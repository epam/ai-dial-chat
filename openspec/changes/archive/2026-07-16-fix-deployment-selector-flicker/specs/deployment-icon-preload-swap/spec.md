## ADDED Requirements

### Requirement: DeploymentIcon preloads a new src before displaying it

`DeploymentIcon` (`libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx`) SHALL keep the currently displayed image visible when its `src` prop changes to a different, non-`undefined` value, and SHALL only render the new image once it has finished loading in the background. The component SHALL NOT render a blank frame between the previous image being visible and the new image appearing.

When the new `src` fails to load, the component SHALL render its fallback (per existing `deployment-icon-failed-state-scoping` behavior) instead of the new image, without ever having rendered a broken-image icon or blank frame for that `src`.

When `src` becomes `undefined`, the fallback SHALL render immediately, with no preload delay.

#### Scenario: Switching between two working icons never shows a blank frame

- **WHEN** `DeploymentIcon` is rendered with `src="a.png"` (already loaded) and then `src` changes to `"b.png"`
- **THEN** the image for `"a.png"` remains visible until `"b.png"` finishes loading, at which point the displayed image updates to `"b.png"` — at no point does the component render neither image

#### Scenario: New src that fails to load shows the fallback directly

- **WHEN** `DeploymentIcon`'s `src` changes to a new value whose preload fails
- **THEN** the component renders its fallback avatar once the failure is known, without first rendering a broken image for that `src`

#### Scenario: Initial mount does not wait on a preload

- **WHEN** `DeploymentIcon` first mounts with a given `src`
- **THEN** the image for that `src` is rendered directly, with no artificial preload delay before the first paint

#### Scenario: src becoming absent shows the fallback immediately

- **WHEN** `DeploymentIcon`'s `src` prop changes to `undefined`
- **THEN** the fallback avatar renders immediately, with no preload wait
