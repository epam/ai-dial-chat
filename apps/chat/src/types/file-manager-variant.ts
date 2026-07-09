/**
 * Identifies which host is driving `useDialFileManager` / `DialFileManagerShell`.
 * `FolderPicker` is a reserved value with no implemented UI yet (#7503+).
 */
export enum DialFileManagerVariant {
  Attach = 'attach',
  Standalone = 'standalone',
  FolderPicker = 'folder-picker',
}

/**
 * Gates which actions `useDialFileManager` exposes per tab. `Attach` excludes
 * Copy/Move/Duplicate (it is a file picker, not a management surface); `Browse`
 * exposes the full #7503 action set. `Full` is reserved for
 * `DialFileManagerVariant.FolderPicker` (#7503+).
 */
export enum DialFileManagerActionProfile {
  Attach = 'attach',
  Browse = 'browse',
  Full = 'full',
}

export const deriveActionProfile = (
  variant: DialFileManagerVariant,
): DialFileManagerActionProfile => {
  switch (variant) {
    case DialFileManagerVariant.Attach:
      return DialFileManagerActionProfile.Attach;
    case DialFileManagerVariant.Standalone:
      return DialFileManagerActionProfile.Browse;
    case DialFileManagerVariant.FolderPicker:
      return DialFileManagerActionProfile.Full;
  }
};
