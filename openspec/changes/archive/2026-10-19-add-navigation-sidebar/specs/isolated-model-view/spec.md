## REMOVED Requirements

### Requirement: Isolated view hides the entire navigation component, not just the mobile sheet

**Reason**: The navigation is one sidebar in every band, and the isolated view hides it as a whole.

**Migration**: Replaced by "Isolated view hides the entire navigation".

## ADDED Requirements

### Requirement: Isolated view hides the entire navigation

`TODO: remove in next release.` `apps/chat/src/app/app.tsx` SHALL NOT render `<SidebarNavigation />` at all (the desktop column and the mobile drawer both) whenever `useIsolatedModelView().isActive` is `true`, regardless of whether the id has resolved yet. This is a direct conditional render at the `<SidebarNavigation />` call site, not a new `OverlayFeature` key, since adding a permanent wire-protocol value for a temporary shim is out of proportion to the need.

#### Scenario: Desktop sidebar is absent
- **WHEN** isolated view is active and the viewport is desktop-width
- **THEN** `SidebarNavigation` (including its logo, nav items, chats and user-menu footer) does not render at all

#### Scenario: Mobile drawer is absent
- **WHEN** isolated view is active and the viewport is mobile-width
- **THEN** no drawer renders (subsumes what `hide-navigation-menu` alone would have covered)

#### Scenario: Navigation is hidden even before the deployment resolves
- **WHEN** isolated view is active (`isActive: true`) but the deployment has not resolved yet
- **THEN** `SidebarNavigation` still does not render — hiding it does not wait for resolution
