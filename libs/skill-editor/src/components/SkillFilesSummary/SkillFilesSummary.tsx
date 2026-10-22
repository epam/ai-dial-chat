import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialItemType, FileIcon } from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import type { FC } from 'react';
import { useId } from 'react';
import type { SkillFilesSummaryProps } from '../../models/skill-files-summary-props';
import { renderIcon } from '../../utils/icon';
import styles from './SkillFilesSummary.module.scss';

/*
 * A native disclosure button rather than the kit `Accordion`: the design puts
 * the caption above an icon-led file name and points the caret down/up, while
 * `Accordion` renders title-then-description with a right-pointing caret.
 */
/** Mobile card that summarises the file being edited and expands in place to reveal the Files pane. */
export const SkillFilesSummary: FC<SkillFilesSummaryProps> = ({
  label,
  fileName,
  isExpanded,
  onToggle,
  children,
  labelClassName = 'dial-tiny-lead-text',
  fileNameClassName = 'dial-small-text',
}) => {
  const id = useId();
  const headerId = `skill-files-summary-header-${id}`;
  const contentId = `skill-files-summary-content-${id}`;

  return (
    <div
      className={mergeClasses(
        'flex flex-col overflow-hidden rounded-xl border shadow-xs',
        styles.card,
      )}
    >
      <button
        id={headerId}
        type="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => onToggle(!isExpanded)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-start focus-visible:outline focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={mergeClasses(styles.label, labelClassName)}>
            {label}
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <FileIcon
              type={DialItemType.File}
              name={fileName}
              className="shrink-0"
              decorative
            />
            <span
              className={mergeClasses(
                'truncate',
                styles.fileName,
                fileNameClassName,
              )}
            >
              {fileName}
            </span>
          </span>
        </span>
        {renderIcon(
          IconChevronDown,
          mergeClasses(
            'shrink-0 transition-transform motion-reduce:transition-none',
            styles.caret,
            isExpanded && 'rotate-180',
          ),
        )}
      </button>
      <div
        inert={!isExpanded}
        className={mergeClasses(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={contentId}
            role="region"
            aria-labelledby={headerId}
            className="px-3 pt-2 pb-3"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
