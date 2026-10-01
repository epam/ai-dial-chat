import { Avatar } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import type { NavigationUserProfile } from '../../models/user-profile';
import styles from './MenuPrimitives.module.scss';

/** Props for `UserAvatar`. */
export interface UserAvatarProps {
  /** Signed-in user details supplying the image URL and initials. */
  profile: NavigationUserProfile;
  /** Alternative text for the image. Pass `''` when a sibling already names the row. */
  alt: string;
}

/** Avatar image with an initials badge fallback for a missing or broken image. */
export const UserAvatar: FC<UserAvatarProps> = memo(({ profile, alt }) => {
  const isFallbackShown = profile.isFallbackShown || !profile.imageUrl;

  return (
    <Avatar
      name={profile.displayName}
      initials={profile.shortName ?? ''}
      src={isFallbackShown ? undefined : profile.imageUrl}
      /* Only the image is named; the initials fallback stays decorative. */
      alt={isFallbackShown ? '' : alt}
      size={28}
      textClassName="dial-tiny-text"
      className={styles.avatar}
      onImageError={profile.onImageError}
    />
  );
});
