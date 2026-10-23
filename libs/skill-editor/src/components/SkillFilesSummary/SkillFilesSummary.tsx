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
      <span className={mergeClasses(styles.label, labelClassName)}>
        {label}
      </span>
    }
    description={
      <FileName
        name={fileName}
        nameClassName={mergeClasses(styles.fileName, fileNameClassName)}
      />
    }
    className={mergeClasses('rounded-xl border py-0 shadow-xs', styles.card)}
    headerClassName={mergeClasses('gap-2 px-3 py-2', styles.header)}
    contentClassName="px-3 pb-3"
  >
    {children}
  </Accordion>
);
