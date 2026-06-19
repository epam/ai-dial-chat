import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type CSSProperties, FC } from 'react';
import styles from './ProviderLogo.module.scss';

/** Props for ProviderLogo. */
export interface ProviderLogoProps {
  /** Background fill color, e.g. '#D97C27' or a CSS var. */
  color: string;
  /** Single character displayed inside the mark. */
  initial: string;
  /** Size in pixels. Default: 48. */
  size?: number;
  /** Typography class for the initial letter. Default: `dial-body-bold-text`. */
  initialClassName?: string;
}

/** Colored circle with a single initial letter — used as a provider logo placeholder. */
export const ProviderLogo: FC<ProviderLogoProps> = ({
  color,
  initial,
  size = 48,
  initialClassName = 'dial-body-bold-text',
}) => {
  const cssVars = {
    '--cat-provider-mark-bg': color,
    '--cat-provider-mark-size': `${size}px`,
    '--cat-provider-mark-font-size': `${size * 0.375}px`,
  } as CSSProperties;

  return (
    <div
      className={mergeClasses(
        'flex flex-shrink-0 items-center justify-center rounded-full',
        styles.mark,
      )}
      style={{
        ...cssVars,
        width: 'var(--cat-provider-mark-size)',
        height: 'var(--cat-provider-mark-size)',
      }}
    >
      <span
        className={mergeClasses(initialClassName, styles.initial)}
        style={{ fontSize: 'var(--cat-provider-mark-font-size)' }}
      >
        {initial}
      </span>
    </div>
  );
};
