import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, ReactNode } from 'react';
import styles from './CredentialsInfoCard.module.scss';

/** Props for {@link CredentialsInfoCard}. */
interface CredentialsInfoCardProps {
  /** Leading icon. */
  icon: ReactNode;
  /** Card title. */
  title: string;
  /** Optional body text shown below the title. */
  description?: string;
  /** Optional action rendered alongside the title (e.g. a "Delete" button). */
  action?: ReactNode;
  /** CSS class applied to the title. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the description. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
}

/** Tinted status card — icon, title, optional description below, optional trailing action — shared by the organization-credentials banner and the personal API-key popover's "key added" state. */
export const CredentialsInfoCard: FC<CredentialsInfoCardProps> = ({
  icon,
  title,
  description,
  action,
  titleClassName = 'dial-small-semi-text',
  descriptionClassName = 'dial-small-text',
}) => (
  <div
    role="status"
    aria-live="polite"
    className={mergeClasses(
      'flex items-start gap-3 rounded-xl p-3',
      styles.card,
    )}
  >
    <span
      className={mergeClasses(
        'shrink-0',
        styles.icon,
        description != null && 'mt-0.5',
      )}
    >
      {icon}
    </span>
    {/*
     * `items-center` here — not on the outer row — so the action centers
     * against the full title+description body, not just the title line.
     */}
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <span className={mergeClasses(titleClassName, styles.title)}>
          {title}
        </span>
        {description != null && (
          <span
            className={mergeClasses(descriptionClassName, styles.description)}
          >
            {description}
          </span>
        )}
      </div>
      {action != null && (
        <div className="shrink-0 whitespace-nowrap">{action}</div>
      )}
    </div>
  </div>
);
