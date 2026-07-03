# Spec: deployment-icon-tooltip (delta)

## ADDED Requirements

### Requirement: `DeploymentIconProps` exposes `initialsName` alongside the existing `tooltip` prop

`DeploymentIconProps` (in `libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx`) SHALL include `initialsName: string` as a **required** field. Adding this field MUST NOT change the behaviour of the existing `src`, `size`, `fallback`, `badgeClassName`, or `tooltip` props.

The full updated `DeploymentIconProps` interface therefore contains:
- `src?: string` — image URL (unchanged)
- `size: number` — badge dimension in px (unchanged)
- `initialsName: string` — **new, required** — displayed as `InitialsAvatar` when no image is available
- `fallback?: ReactNode` — custom fallback node (unchanged)
- `badgeClassName?: string` — extra badge class (unchanged)
- `tooltip?: string` — tooltip text on hover/focus (unchanged)

#### Scenario: Existing tooltip behaviour unaffected by initialsName

- **WHEN** `<DeploymentIcon size={36} initialsName="My App" tooltip="My App" />` renders
- **THEN** hovering the badge shows the tooltip containing "My App" (tooltip behaviour is unchanged)

#### Scenario: initialsName and tooltip coexist correctly

- **WHEN** `<DeploymentIcon size={36} initialsName="My App" tooltip="My App" />` renders with no `src`
- **THEN** the badge shows the initials avatar AND hovering shows the tooltip
