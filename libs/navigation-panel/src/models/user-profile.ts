/** Signed-in user details needed to render the identity row and avatar. */
export interface NavigationUserProfile {
  /** Address shown in the avatar tooltip and the "signed in as" label. */
  email: string;
  /** Full name, falling back to the email when no name claim exists. */
  displayName: string;
  /** One-or-two-letter initials rendered when no avatar image is available. */
  shortName?: string;
  /** Avatar image URL, already resolved to something usable as an `<img src>`. */
  imageUrl?: string;
  /** Whether the initials badge replaces the image (no image, or it failed to load). */
  isFallbackShown?: boolean;
  /** Called when the avatar image fails to load so the host can flip to initials. */
  onImageError?: () => void;
}
