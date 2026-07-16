## ADDED Requirements

### Requirement: Failed-image fallback state is scoped to the displayed src that produced it

`DeploymentIcon` (`libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx`) SHALL only render its fallback (`fallback` prop or `InitialsAvatar`) due to an image load failure when the currently displayed image source is the same source whose load actually failed (whether the failure was detected during background preload — see `deployment-icon-preload-swap` — or by the rendered `<img>` element itself). A newly displayed source SHALL NOT render the fallback on account of a previous, different source's load failure.

This is an internal state-management guarantee for `DeploymentIcon`; the component's public props (`src`, `size`, `initialsName`, `fallback`, `badgeClassName`, `tooltip`) are unchanged.

#### Scenario: Switching from a failed icon to a working icon shows the working icon, not the fallback

- **WHEN** `DeploymentIcon` is rendered with `src="a.png"` whose load fails (fallback shown), and then `src` changes to `"b.png"` which preloads successfully
- **THEN** once `"b.png"` is displayed, the fallback avatar is no longer shown — `"b.png"`'s image renders instead

#### Scenario: Switching between two working icons never shows a fallback

- **WHEN** `DeploymentIcon` is rendered with `src="a.png"` (loads successfully) and then `src` changes to `"b.png"` (also loads successfully)
- **THEN** no fallback avatar is rendered at any point during the transition

#### Scenario: A new src that also fails still shows the fallback

- **WHEN** `DeploymentIcon`'s `src` changes to a new value whose preload also fails
- **THEN** the fallback avatar is rendered for that new value once the failure is known

#### Scenario: Absent src always shows the fallback regardless of prior failed state

- **WHEN** `DeploymentIcon` is rendered with `src={undefined}` after a previous `src` had failed to load
- **THEN** the fallback avatar is rendered immediately, consistent with existing behavior for a missing `src`
