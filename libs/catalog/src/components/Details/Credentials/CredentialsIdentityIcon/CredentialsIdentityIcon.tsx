import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import { FC, ReactNode } from 'react';
import styles from './CredentialsIdentityIcon.module.scss';

/**
 * Surface the chip sits on. The management sub-view's rows sit on the panel
 * background, so their chip is sunken; the banner's chip sits inside an
 * already-tinted `CredentialsInfoCard`, so it has to come forward instead.
 */
export enum CredentialsIconSurface {
  Sunken = 'sunken',
  Raised = 'raised',
}

const SURFACE_CLASS: Record<CredentialsIconSurface, string> = {
  [CredentialsIconSurface.Sunken]: styles.sunkenBox,
  [CredentialsIconSurface.Raised]: styles.raisedBox,
};

/** Props for {@link CredentialsIdentityIcon}. */
interface CredentialsIdentityIconProps {
  /** Icon identifying the credentials level (personal or organization). */
  icon: ReactNode;
  /** Whether this level's credentials are the ones currently in effect; adds the overlapping checkmark badge. */
  isActive?: boolean;
  /** Surface the chip is drawn on. Defaults to {@link CredentialsIconSurface.Sunken}. */
  surface?: CredentialsIconSurface;
  /** Screen-reader-only text describing the state the checkmark conveys visually. Omit where surrounding copy already states it. */
  statusLabel?: string;
}

/**
 * Rounded icon chip for one credentials level, with an overlapping checkmark
 * badge when that level is in effect. Shared by the management sub-view's rows
 * and the details banner so both read as the same element.
 */
export const CredentialsIdentityIcon: FC<CredentialsIdentityIconProps> = ({
  icon,
  isActive = false,
  surface = CredentialsIconSurface.Sunken,
  statusLabel,
}) => (
  <span className="relative inline-flex shrink-0">
    <span
      className={mergeClasses(
        'flex size-8 items-center justify-center rounded-lg',
        SURFACE_CLASS[surface],
      )}
    >
      {icon}
    </span>
    {isActive && (
      <IconCircleCheckFilled
        size={DIAL_ICON_SIZE.MD}
        aria-hidden
        className={mergeClasses('absolute -end-2 -top-2', styles.activeIcon)}
      />
    )}
    {statusLabel != null && <span className="sr-only">{statusLabel}</span>}
  </span>
);
