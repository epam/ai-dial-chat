import { memo, type FC } from 'react';
import type { NavigationUserProfile } from '../../models/user-profile';
import { AvatarInitials } from './AvatarInitials';

/** Props for `UserAvatar`. */
export interface UserAvatarProps {
  /** Signed-in user details supplying the image URL and initials. */
  profile: NavigationUserProfile;
  /** Alternative text for the image. Pass `''` when a sibling already names the row. */
  alt: string;
}

/** Avatar image with an initials badge fallback for a missing or broken image. */
export const UserAvatar: FC<UserAvatarProps> = memo(({ profile, alt }) =>
  profile.isFallbackShown || !profile.imageUrl ? (
    <AvatarInitials shortName={profile.shortName} />
  ) : (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      className="rounded-full"
      src={profile.imageUrl}
      width={28}
      height={28}
      alt={alt}
      onError={profile.onImageError}
    />
  ),
);
