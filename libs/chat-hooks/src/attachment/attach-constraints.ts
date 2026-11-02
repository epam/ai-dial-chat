import { mimeTypesToExtensionLabels } from '@epam/ai-dial-attachment-input';
import { formatFileSize } from '@epam/ai-dial-chat-shared';

/** The limits an attach dialog enforces; an absent or non-positive value is no limit. */
export interface AttachConstraints {
  /** Allowed MIME types; `*` or `*\/*` allows every type. */
  allowedTypes?: readonly string[];
  /** Host-written label for the allowed types, used instead of one derived from `allowedTypes`. */
  allowedTypesLabel?: string;
  /** Largest file size, in bytes. */
  maxFileSize?: number;
  /** Most files per attach. */
  maxCount?: number;
}

/** Localized pieces of the constraint description. */
export interface AttachConstraintLabels {
  /** Type label when every type is allowed, e.g. `'All types'`. */
  allTypes: string;
  /** Sentence naming the size limit and the allowed types. */
  maxSizeWithTypes: (maxSize: string, allowedTypes: string) => string;
  /** Sentence naming only the size limit. */
  maxSizeOnly: (maxSize: string) => string;
  /** Sentence naming the file-count limit. */
  upToFiles: (count: number) => string;
}

/** Returns `true` when the MIME-type list allows every type (`*` or `*\/*`). */
export const areAllMimeTypesAllowed = (types: readonly string[]): boolean =>
  types.some((type) => type === '*' || type === '*/*');

const resolveTypeLabel = (
  { allowedTypes, allowedTypesLabel }: AttachConstraints,
  labels: AttachConstraintLabels,
): string | undefined => {
  if (allowedTypesLabel != null) return allowedTypesLabel;
  if (allowedTypes == null || allowedTypes.length === 0) return undefined;
  if (areAllMimeTypesAllowed(allowedTypes)) return labels.allTypes;
  return mimeTypesToExtensionLabels([...allowedTypes]);
};

/**
 * Returns the attach dialog's constraint description — the size and type
 * limits as one sentence, then the count limit, joined with `. ` and ending
 * in `.` — or `null` when nothing is limited.
 */
export const buildAttachConstraintDescription = (
  constraints: AttachConstraints,
  labels: AttachConstraintLabels,
): string | null => {
  const { allowedTypes, maxFileSize, maxCount } = constraints;
  const hasTypeConstraint = allowedTypes != null && allowedTypes.length > 0;
  const hasSizeConstraint = maxFileSize != null && maxFileSize > 0;
  const hasCountConstraint =
    maxCount != null && maxCount > 0 && Number.isFinite(maxCount);

  if (!hasTypeConstraint && !hasSizeConstraint && !hasCountConstraint) {
    return null;
  }

  const parts: string[] = [];

  if (hasTypeConstraint || hasSizeConstraint) {
    const typeLabel = resolveTypeLabel(constraints, labels);
    const maxSize = hasSizeConstraint ? formatFileSize(maxFileSize) : undefined;

    if (typeLabel != null && maxSize != null) {
      parts.push(labels.maxSizeWithTypes(maxSize, typeLabel));
    } else if (maxSize != null) {
      parts.push(labels.maxSizeOnly(maxSize));
    } else if (typeLabel != null) {
      parts.push(typeLabel);
    }
  }

  if (hasCountConstraint) {
    parts.push(labels.upToFiles(maxCount));
  }

  return `${parts.join('. ')}.`;
};
