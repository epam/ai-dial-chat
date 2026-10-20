/** How `UserMenu` presents its trigger. */
export enum UserMenuTriggerVariant {
  /** Avatar only, centred in a 60px square — the rail's footer. */
  Avatar = 'avatar',
  /** Avatar, display name and a chevron in one pill — the expanded sidebar's footer. */
  Profile = 'profile',
  /** Avatar only, in a 40px pill that opens the menu at the start edge — the collapsed sidebar's footer. */
  Compact = 'compact',
}
