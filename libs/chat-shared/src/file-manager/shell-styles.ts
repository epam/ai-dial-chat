/** CSS custom-property overrides for `OperationLoaderModal`. */
export interface OperationLoaderModalColors {
  /** Text color of the progress line under the title. Defaults to `--text-secondary`. */
  text?: string;
}

/** CSS custom-property overrides for `DialFileManagerShell`. */
export interface DialFileManagerShellColors {
  /** Background of the shell's surface. Defaults to `--bg-layer-base`. */
  surface?: string;
  /** Background of the folder tree in the attach variant. Defaults to `--bg-layer-raised`. */
  treeBackground?: string;
  /** Border color between the folder tree and the grid in the attach variant. Defaults to `--stroke-tertiary`. */
  treeBorder?: string;
  /** Scrim behind the spinner shown while an overlay operation runs. Defaults to `--bg-backdrop`. */
  overlayBackdrop?: string;
}

/** Style overrides for `DialFileManagerShell`. */
export interface DialFileManagerShellStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: DialFileManagerShellColors;
  /** Color overrides forwarded to the copy/move `OperationLoaderModal`. */
  operationLoader?: OperationLoaderModalColors;
  /** Typography class of the copy/move `OperationLoaderModal` secondary text. Defaults to `'dial-small-text'`. */
  operationLoaderTextClassName?: string;
}

/** CSS custom-property overrides for `FileManagerAttachModal`. */
export interface FileManagerAttachModalColors {
  /** Background of the dialog and of the file-manager surface inside it. Defaults to `--bg-layer-raised`. */
  background?: string;
  /** Text color of the title when a header description is shown. Defaults to `--text-primary`. */
  title?: string;
}
