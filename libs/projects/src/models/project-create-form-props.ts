import type {
  TextRefinementCallback,
  TextRefinementLabels,
} from '@epam/ai-dial-chat-shared';
import type { EditorThemes } from '@epam/ai-dial-ui-kit';
import type { ContextFileRejection } from '../types/context-file-rejection';
import type { ProjectNameError } from '../types/project-name-error';
import type { ProjectContextFile } from './project-context-file';

/** Text fields of the {@link ProjectCreateForm}, owned by the host. */
export interface ProjectCreateFormValues {
  /** Project name; the host trims it before sending. */
  name: string;
  /** Plain-text description. */
  description: string;
  /** Markdown instructions. */
  instructions: string;
}

/** Host-supplied errors, e.g. from a rejected create request. */
export interface ProjectCreateFormErrors {
  /** Shown under Name; takes precedence over the form's own name check. */
  name?: string;
  /** Shown under the Context drop zone. */
  context?: string;
}

/** Localized labels used by the {@link ProjectCreateForm} component. */
export interface ProjectCreateFormLabels {
  /** Page title, e.g. "New project". */
  title: string;
  /** Accessible name of the back button. */
  backLabel: string;
  /** Cancel button label. */
  cancelLabel: string;
  /** Create button label. */
  createLabel: string;
  /** Create button label while the request is in flight. Defaults to `createLabel`. */
  submittingLabel?: string;
  /** Name field label. */
  nameLabel: string;
  /** Name field placeholder, e.g. "Enter project name". */
  namePlaceholder: string;
  /** Message per client-side name check failure. */
  nameErrors: Record<ProjectNameError, string>;
  /** Description field label. */
  descriptionLabel: string;
  /** Description placeholder, e.g. "Describe what the project is about". */
  descriptionPlaceholder: string;
  /** Instructions field label. */
  instructionsLabel: string;
  /** Instructions editor placeholder. */
  instructionsPlaceholder: string;
  /** Context section label. */
  contextLabel: string;
  /** Drop zone copy, e.g. "Drag&drop context, upload from device or file manager". */
  dropZoneLabel: string;
  /** Drop zone hint, e.g. "File formats .csv, .pdf and .xlsx (max 1 MB)". */
  dropZoneHint: string;
  /** Add menu trigger label. */
  addLabel: string;
  /** Add menu item that opens the device file picker. */
  addFromDeviceLabel: string;
  /** Add menu item that opens the host's file manager. */
  addFromFileManagerLabel: string;
  /** Title of the overlay shown while files are dragged over the form. */
  dropOverlayTitle?: string;
  /** Subtitle of that overlay. */
  dropOverlaySubtitle?: string;
  /** Accessible name of the capacity meter, e.g. "Context capacity". */
  capacityMeterLabel: string;
  /** Visible capacity text, e.g. "10% of capacity used". */
  capacityLabel: (percent: number) => string;
  /** Accessible name of a file card's remove button, e.g. "Remove tickets.csv". */
  removeFileLabel: (name: string) => string;
  /** Message per client-side file rejection, given the file name. */
  fileRejections: Record<ContextFileRejection, (name: string) => string>;
  /** Announced after files are added, e.g. "2 files added". */
  filesAddedStatus: (count: number) => string;
  /** Announced after a file is removed, e.g. "tickets.csv removed". */
  fileRemovedStatus: (name: string) => string;
  /** Announced when a submission starts, e.g. "Creating project…". */
  creatingStatus: string;
  /** Refine with AI copy for Description and Instructions. */
  refinement?: TextRefinementLabels;
}

/**
 * Color overrides for the {@link ProjectCreateForm} component, applied as CSS
 * custom properties with app theme fallbacks.
 */
export interface ProjectCreateFormColors {
  /** Page background. Fallback: `--bg-layer-base`. */
  background?: string;
  /** Header border. Fallback: `--stroke-tertiary`. */
  headerBorder?: string;
  /** Instructions and Context field labels, and the Description label when Refine with AI is wired. Fallback: `--text-secondary`. */
  labelText?: string;
  /** Hint, rejection and capacity text. Fallback: `--text-secondary`. */
  helperText?: string;
  /** Capacity meter track. Fallback: `--bg-layer-sunken`. */
  meterTrack?: string;
  /** Capacity meter fill. Fallback: `--stroke-accent`. */
  meterFill?: string;
}

/** Typography overrides for the {@link ProjectCreateForm} component. */
export interface ProjectCreateFormTypography {
  /** CSS class applied to the page title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to field labels. Defaults to `'dial-tiny-semi-text'`. */
  labelClassName?: string;
  /** CSS class applied to hints, rejections and capacity text. Defaults to `'dial-tiny-text'`. */
  helperClassName?: string;
}

/** Style overrides for the {@link ProjectCreateForm} component. */
export interface ProjectCreateFormStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ProjectCreateFormColors;
  /** Typography class overrides. */
  typography?: ProjectCreateFormTypography;
}

/** Props for the {@link ProjectCreateForm} component. */
export interface ProjectCreateFormProps {
  /** Current field values (controlled). */
  values: ProjectCreateFormValues;
  /** Host-supplied field errors. */
  errors: ProjectCreateFormErrors;
  /** Called with a field and its new value. */
  onFieldChange: <K extends keyof ProjectCreateFormValues>(
    field: K,
    value: ProjectCreateFormValues[K],
  ) => void;
  /** Context files, stored or newly added (controlled). */
  contextFiles: ProjectContextFile[];
  /** Called with the next context file list after an add or a remove. */
  onContextFilesChange: (files: ProjectContextFile[]) => void;
  /** Lower-case extensions, without a dot, accepted as context files. */
  allowedExtensions: string[];
  /** Maximum size of one context file, in bytes. */
  maxFileBytes: number;
  /** Maximum combined size of the context files (the capacity), in bytes. */
  maxTotalBytes: number;
  /**
   * Opens the host's file manager and resolves the picked files, or
   * `undefined` when cancelled. The File manager source is hidden when omitted.
   */
  onPickFromFileManager?: () => Promise<File[] | undefined>;
  /** Rewrites the description; the Refine with AI action is hidden when omitted. */
  onRefineDescription?: TextRefinementCallback;
  /** Rewrites the instructions; the Refine with AI action is hidden when omitted. */
  onRefineInstructions?: TextRefinementCallback;
  /** Called when the user activates the back button. */
  onBack: () => void;
  /** Called when the user activates Cancel. */
  onCancel: () => void;
  /** Called when the user activates Create on a valid form. */
  onSubmit: () => void;
  /** Disables Create and shows its loading state. Defaults to `false`. */
  isSubmitting?: boolean;
  /** Localized labels. */
  labels: ProjectCreateFormLabels;
  /** Theme of the markdown editor. */
  markdownEditorTheme?: EditorThemes;
  /** Additional CSS class on the root element. */
  className?: string;
  /** Color and typography overrides. */
  styles?: ProjectCreateFormStyles;
}
