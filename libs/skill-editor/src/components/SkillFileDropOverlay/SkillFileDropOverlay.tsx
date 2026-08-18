import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconUpload } from '@tabler/icons-react';
import type { FC } from 'react';
import type { SkillEditorLabels } from '../../models/skill-editor-props';

/** Props for `SkillFileDropOverlay`. */
export interface SkillFileDropOverlayProps {
  /** Whether the overlay is shown. */
  isVisible: boolean;
  /** Text overrides. */
  labels?: Pick<SkillEditorLabels, 'dropOverlayTitle' | 'dropOverlaySubtitle'>;
}

/**
 * Full-surface overlay shown while a file-bearing drag is over the editor
 * and the upload dialog isn't open yet, mirroring the chat composer's
 * page-wide drag overlay so the interaction feels consistent app-wide.
 */
export const SkillFileDropOverlay: FC<SkillFileDropOverlayProps> = ({
  isVisible,
  labels,
}) => {
  if (!isVisible) return null;
  const t = labels ?? {};

  return (
    <div
      role="status"
      aria-live="polite"
      className={mergeClasses(
        'pointer-events-none absolute inset-0 z-[100] flex items-center justify-center backdrop-blur-sm',
      )}
    >
      <div className="flex flex-col items-center text-center">
        <IconUpload size={100} className="text-accent-primary" aria-hidden />
        <span className="dial-h3-text mt-5">
          {t.dropOverlayTitle ?? 'Upload files'}
        </span>
        <span className="dial-small-text mt-4">
          {t.dropOverlaySubtitle ?? 'Drop files here to add them to this skill'}
        </span>
      </div>
    </div>
  );
};
