import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  LiveRegion,
  LiveRegionElement,
} from '@epam/ai-dial-ui-kit';
import { IconUpload } from '@tabler/icons-react';
import type { FC } from 'react';
import type { SkillEditorLabels } from '../../models/skill-editor-props';
import styles from './SkillFileDropOverlay.module.scss';

/** Props for `SkillFileDropOverlay`. */
export interface SkillFileDropOverlayProps {
  /** Whether the overlay is shown. */
  isVisible: boolean;
  /** Text overrides. */
  labels?: Pick<SkillEditorLabels, 'dropOverlayTitle' | 'dropOverlaySubtitle'>;
  /** Typography class of the title. Defaults to `'dial-h3-text'`. */
  titleClassName?: string;
  /** Typography class of the subtitle. Defaults to `'dial-small-text'`. */
  subtitleClassName?: string;
}

/**
 * Full-surface overlay shown while a file-bearing drag is over the editor
 * and the upload dialog isn't open yet, mirroring the chat composer's
 * page-wide drag overlay so the interaction feels consistent app-wide.
 */
export const SkillFileDropOverlay: FC<SkillFileDropOverlayProps> = ({
  isVisible,
  labels,
  titleClassName = 'dial-h3-text',
  subtitleClassName = 'dial-small-text',
}) => {
  const t = labels ?? {};
  const title = t.dropOverlayTitle ?? 'Upload files';
  const subtitle =
    t.dropOverlaySubtitle ?? 'Drop files here to add them to this skill';

  /* The status region stays mounted while the overlay is hidden, so its text
     change is announced reliably when a drag starts. */
  const statusRegion = (
    <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
      {isVisible ? `${title}. ${subtitle}` : ''}
    </LiveRegion>
  );

  if (!isVisible) return statusRegion;

  return (
    <>
      {statusRegion}
      <div
        className={mergeClasses(
          'pointer-events-none absolute inset-0 z-[100] flex items-center justify-center backdrop-blur-sm',
        )}
      >
        {/* The status region above already speaks this text. */}
        <div aria-hidden className="flex flex-col items-center text-center">
          <IconUpload
            size={100}
            className={styles.icon}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
          <span className={mergeClasses('mt-5', titleClassName)}>{title}</span>
          <span className={mergeClasses('mt-4', subtitleClassName)}>
            {subtitle}
          </span>
        </div>
      </div>
    </>
  );
};
