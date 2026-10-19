/** How `NavigationSidebar` is laid out. */
export enum NavigationSidebarVariant {
  /** A persistent column, 336px expanded or 72px collapsed, with a collapse toggle in its header. */
  Sidebar = 'sidebar',
  /** A 320px panel the host slides over the content, with a close button in its header instead of the toggle. */
  Drawer = 'drawer',
}
