import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './TopicTag.module.scss';

/** Props for TopicTag. */
export interface TopicTagProps {
  /** Text to display inside the tag, e.g. 'Free' or 'Pay-as-you-go'. */
  label: string;
  /** CSS class for the tag text. Default: 'dial-tiny-text'. */
  className?: string;
}

/** Simple tag component for displaying item topics or pricing tiers. */
export const TopicTag: FC<TopicTagProps> = ({
  label,
  className = 'dial-tiny-text',
}) => <DialTag label={label} className={mergeClasses(className, styles.tag)} />;
