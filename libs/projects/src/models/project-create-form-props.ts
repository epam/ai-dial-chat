import type {
  TextRefinementCallback,
  TextRefinementLabels,
} from '@epam/ai-dial-chat-shared';
import type { EditorThemes } from '@epam/ai-dial-ui-kit';
import type { ReactElement, ReactNode } from 'react';
import type { ContextFileRejection } from '../types/context-file-rejection';
import type { ProjectNameError } from '../types/project-name-error';
import type { ProjectContextFile } from './project-context-file';

/** Text fields of the {@link ProjectCreateForm}, owned by the host. */
export interface ProjectCreateFormValues {
  /** Project name; the host trims it before sending. */
  name: string;
  /** Markdown instructions. */
  instructions: string;
}

/** Host-supplied errors, e.g. from a rejected create request. */
export interface ProjectCreateFormErrors {
  /** Shown under Name; takes precedence over the form's own name check. */
  name?: string;
  /** Shown as the Context drop zone's error, after any client rejections. */
  context?: string;
}

/**
 * Empty link elements the {@link ProjectCreateForm} drop zone copy wraps
 * around its link text.
 */
export interface ProjectDropZoneLinks {
  /** Underlined text; the whole drop zone opens the device picker. */
  fromDevice: ReactElement;
  /** Button that opens the host's file manager; absent without `onPickFromFileManager`. */
  fileManager?: ReactElement;
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
  /** Instructions field label. */
  instructionsLabel: string;
  /** Instructions editor placeholder. */
  instructionsPlaceholder: string;
  /** Accessible label of the spinner shown while the instructions editor loads. Defaults to `'Loading editor'`. */
  editorLoadingAriaLabel?: string;
  /** Context section label. */
  contextLabel: string;
  /**
   * Drop zone copy, e.g. "Drag&drop context, upload from device or file
   * manager". Place the given link elements in the sentence and give each its
   * text, e.g. through a translation library's rich-text interpolation.
   */
  dropZoneLabel: (links: ProjectDropZoneLinks) => ReactNode;
  /** Accessible name of the drop zone's file input, e.g. "Upload context from device". */
  dropZoneAriaLabel?: string;
  /** Drop zone hint, e.g. "File formats .csv, .pdf and .xlsx (max 1 MB)". */
  dropZoneHint: string;
  /** Title of the overlay shown while files are dragged over the form. */
  dropOverlayTitle?: string;
  /** Subtitle of that overlay. */
  dropOverlaySubtitle?: string;
  /** Accessible name of a file card's remove button, e.g. "Remove tickets.csv". */
  removeFileLabel: (name: string) => string;
  /** Accessible name of a clickable file card; read only when `onContextFileClick` is set. Defaults to `Preview {name}`, e.g. "Preview tickets.csv". */
  openFileLabel?: (name: string) => string;
  /** Message per client-side file rejection, given the file name; shown as the drop zone's error, one per line. */
  fileRejections: Record<ContextFileRejection, (name: string) => string>;
  /** Announced after files are added, e.g. "2 files added". */
  filesAddedStatus: (count: number) => string;
  /** Announced after a file is removed, e.g. "tickets.csv removed". */
  fileRemovedStatus: (name: string) => string;
  /** Announced when a submission starts, e.g. "Creating project…". */
  creatingStatus: string;
  /** Refine with AI copy for Instructions. */
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
  /** Instructions and Context field labels. Fallback: `--text-secondary`. */
  labelText?: string;
  /** Drop zone "from device" and "file manager" links. Fallback: the drop zone text color. */
  linkText?: string;
  /** Context drop zone background while it is idle. Fallback: `--bg-layer-raised`, then `#d1dbea`. */
  dropZoneBackground?: string;
}

/** Typography overrides for the {@link ProjectCreateForm} component. */
export interface ProjectCreateFormTypography {
  /** CSS class applied to the page title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to field labels. Defaults to `'dial-tiny-semi-text'`. */
  labelClassName?: string;
  /** CSS class applied to the Name error. Defaults to `'dial-tiny-text'`. */
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
  /** Called with a card's `ProjectContextFile.id` when the user activates it; the cards are not clickable when omitted. */
  onContextFileClick?: (id: string) => void;
  /** `ProjectContextFile.id` of the card that renders selected; no card is selected when unset. */
  selectedContextFileId?: string;
  /** Lower-case extensions, without a dot, accepted as context files. */
  allowedExtensions: string[];
  /** Maximum size of one context file, in bytes. */
  maxFileBytes: number;
  /** Maximum combined size of the context files, in bytes; a file over it is rejected. */
  maxTotalBytes: number;
  /**
   * Opens the host's file manager and resolves the picked files, or
   * `undefined` when cancelled. The drop zone's file manager link is absent when omitted.
   */
  onPickFromFileManager?: () => Promise<File[] | undefined>;
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
