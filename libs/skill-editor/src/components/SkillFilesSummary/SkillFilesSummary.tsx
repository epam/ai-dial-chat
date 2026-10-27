import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Accordion, FileName } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { SkillFilesSummaryProps } from '../../models/skill-files-summary-props';
import styles from './SkillFilesSummary.module.scss';

/** Mobile card that summarises the file being edited and expands in place to reveal the Files pane. */
export const SkillFilesSummary: FC<SkillFilesSummaryProps> = ({
  label,
  fileName,
  isExpanded,
  onToggle,
  children,
  labelClassName = 'dial-tiny-lead-text',
  fileNameClassName = 'dial-small-text',
}) => (
  <Accordion
    expanded={isExpanded}
    onToggle={onToggle}
    title={
      <span className={mergeClasses('block', styles.label, labelClassName)}>
        {label}
      </span>
    }
    description={
      <FileName
        name={fileName}
        nameClassName={mergeClasses(styles.fileName, fileNameClassName)}
      />
    }
    className={mergeClasses('rounded-lg border py-0 shadow-xs', styles.card)}
    headerClassName={mergeClasses(
      'gap-4 rounded-lg py-2 ps-3 pe-2 text-start [&>span]:flex-1 [&>span]:gap-1 [&>svg]:size-6',
      isExpanded ? '[&>svg]:-rotate-90' : '[&>svg]:rotate-90',
      styles.header,
    )}
    contentClassName="max-h-[416px] overflow-y-auto pt-4 pb-2 ps-3 pe-2"
  >
    {children}
  </Accordion>
);
