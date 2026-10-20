## REMOVED Requirements

### Requirement: Hamburger button opens the sheet on mobile

**Reason**: The application no longer mounts `NavigationSheet`: on mobile the same sidebar opens as a drawer from a header toggle (see `navigation-sidebar`, "Mobile drawer" and "Mobile header"). The sheet and its pages stay in `libs/navigation-panel` for hosts that compose them.

**Migration**: Hosts that want the sheet keep composing `NavigationSheet` themselves; the app uses `NavigationSidebar` with `NavigationSidebarVariant.Drawer`.
