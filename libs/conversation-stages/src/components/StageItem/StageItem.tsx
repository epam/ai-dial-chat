import type { Stage } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { FC, useState } from 'react';
import { StageIcon } from '../StageIcon/StageIcon.js';
import styles from '../StagesPanel/StagesPanel.module.scss';

/** A single stage row — plain when no content, collapsible when content is present. */
export const StageItem: FC<{ stage: Stage; typographyClassName: string }> = ({
  stage,
  typographyClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const header = (
    <>
      <StageIcon status={stage.status} />
      <span className={mergeClasses('truncate capitalize', styles.stageName)}>
        {stage.name || stage.status}
      </span>
    </>
  );

  if (!stage.content) {
    return <div className="flex items-center gap-2">{header}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-2 bg-transparent p-0"
      >
        {header}
        {isOpen ? (
          <IconChevronDown
            size={DIAL_ICON_SIZE.MD}
            className={styles.iconSecondary}
          />
        ) : (
          <IconChevronRight
            size={DIAL_ICON_SIZE.MD}
            className={styles.iconSecondary}
          />
        )}
      </button>
      <div
        className={mergeClasses(
          styles.contentWrapper,
          isOpen && styles.contentWrapperOpen,
        )}
      >
        <div className={styles.contentInner}>
          <div
            className={mergeClasses(
              'mt-3 pl-7',
              styles.stageContent,
              typographyClassName,
            )}
          >
            {stage.content}
          </div>
        </div>
      </div>
    </div>
  );
};
