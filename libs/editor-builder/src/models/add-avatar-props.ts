/** CSS custom property overrides for `AddAvatar`. */
export interface AddAvatarColors {
  /** Background color of the 64x64 preview box shown when no avatar is set. Defaults to `--bg-layer-raised`. */
  boxBackgroundColor?: string;
  /** Border color of the 64x64 preview box. Defaults to `--stroke-tertiary`. */
  boxBorderColor?: string;
  /** Color of the placeholder photo icon shown when no avatar is set. Defaults to `--text-secondary`. */
  placeholderIconColor?: string;
  /** Color of the format/size caption text. Defaults to `--text-tertiary`. */
  captionColor?: string;
}

/** Style overrides for `AddAvatar`. */
export interface AddAvatarStyles {
  /** Color token overrides. */
  colors?: AddAvatarColors;
}

/** Props for `AddAvatar`. */
export interface AddAvatarProps {
  /** Field label rendered above the preview box and button (e.g. `'Avatar'`). */
  label: string;
  /** URL of the currently selected avatar image. When set, it fills the 64x64 preview box instead of the placeholder icon. */
  avatarUrl?: string;
  /** Alt text for the avatar image. Defaults to `''` (decorative — the field label and button already describe the control). */
  avatarAlt?: string;
  /** Label for the "Add avatar" button. Defaults to `'Add avatar'`. */
  addAvatarLabel?: string;
  /** Caption text describing the accepted formats and max size. Defaults to `'PNG, JPG or SVG (max 1 MB)'`. */
  captionText?: string;
  /** Called when the "Add avatar" button is clicked. The host opens its own file picker/manager and, once a file is chosen, passes its URL back in as `avatarUrl`. */
  onAddAvatarClick: () => void;
  /** Style overrides applied via CSS custom properties. */
  styles?: AddAvatarStyles;
  /** Additional CSS class applied to the root element. */
  className?: string;
}
