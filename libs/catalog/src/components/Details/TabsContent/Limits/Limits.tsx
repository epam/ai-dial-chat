import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { LimitsTabProps } from '../../../../models/limits-props';
import { LimitGroupSection } from './LimitGroupSection';
import styles from './Limits.module.scss';

/** Renders model usage limits as named groups (e.g. token limits, cost limits), each a list of capped progress rows or plain-value rows. */
export const LimitsTab: FC<LimitsTabProps> = ({
  limits,
  labelClassName = 'dial-small-semi-text',
  captionClassName = 'dial-caption-text',
  valueClassName = 'dial-tiny-text',
  noteValueClassName = 'dial-tiny-semi-text',
  noteClassName = 'dial-caption-text',
  sectionClassName = 'dial-caption-text',
  footerClassName = 'dial-caption-text',
  footerNote,
  colors,
}) => {
  const groups = limits?.groups.filter((group) => group.rows.length > 0);

  if (groups == null || groups.length === 0) {
    return null;
  }

  const cssVars = buildCssVars({
    '--lt-section-heading': colors?.sectionHeading,
    '--lt-label': colors?.label,
    '--lt-value-primary': colors?.valuePrimary,
    '--lt-divider': colors?.divider,
    '--lt-progress-track': colors?.progressTrack,
    '--lt-progress-fill-default': colors?.progressFillDefault,
    '--lt-progress-fill-warning': colors?.progressFillWarning,
    '--lt-progress-fill-danger': colors?.progressFillDanger,
  });

  return (
    <div className="flex flex-col gap-6" style={cssVars}>
      {groups.map((group) => (
        <LimitGroupSection
          key={group.label}
          group={group}
          sectionClassName={sectionClassName}
          labelClassName={labelClassName}
          captionClassName={captionClassName}
          valueClassName={valueClassName}
          noteValueClassName={noteValueClassName}
          noteClassName={noteClassName}
        />
      ))}

      {footerNote != null && (
        <p
          className={mergeClasses(
            'm-0 border-t pt-4',
            footerClassName,
            styles.divider,
            styles.label,
          )}
        >
          {footerNote}
        </p>
      )}
    </div>
  );
};
