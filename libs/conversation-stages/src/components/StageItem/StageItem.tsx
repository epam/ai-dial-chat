import type { Stage } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { FC, useState } from 'react';
import type { StageTypography } from '../../models/stages-props';
import { StageIcon } from '../StageIcon/StageIcon';
import { StageMarkdownContent } from '../StageMarkdownContent/StageMarkdownContent';
import styles from '../StagesPanel/StagesPanel.module.scss';

interface Props {
  /** The stage data to render. */
  stage: Stage;
  /** Whether this stage is the currently executing (live) stage. */
  isLive: boolean;
  /** Typography configuration applied to stage text elements. */
  typography: StageTypography;
  /** Accessible label for the copy button inside stage content. */
  copyAriaLabel?: string;
}

/** A single stage row — plain when no content, collapsible when content is present. */
export const StageItem: FC<Props> = ({
  stage,
  isLive,
  typography,
  copyAriaLabel = 'Copy stage content',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const header = (
    <>
      <StageIcon status={stage.status} isLive={isLive} />
      <span
        className={mergeClasses(
          'min-w-0 flex-1 truncate capitalize',
          styles.stageName,
        )}
      >
        <DialEllipsisTooltip text={stage.name || stage.status} />
      </span>
    </>
  );

  const hasExpandableContent = !!stage.content;

  if (!hasExpandableContent) {
    return <div className="flex items-center gap-2">{header}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={mergeClasses(
          'flex w-full cursor-pointer items-center gap-2 p-0',
          styles.collapseButton,
        )}
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
            className={mergeClasses(styles.iconSecondary, 'rtl:scale-x-[-1]')}
          />
        )}
      </button>
      <div
        className={mergeClasses(
          'grid overflow-hidden transition-[grid-template-rows] duration-[250ms] ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 flex flex-col gap-3 ps-7">
            {stage.content && (
              <div className="max-h-[300px] overflow-y-auto">
                <StageMarkdownContent
                  content={stage.content}
                  typography={typography}
                  copyAriaLabel={copyAriaLabel}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
