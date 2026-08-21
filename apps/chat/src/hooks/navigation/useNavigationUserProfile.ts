import type { NavigationUserProfile } from '@epam/ai-dial-navigation-panel';
import { useCallback, useMemo } from 'react';
import { useUserProfile } from '../user-profile/useUserProfile';

/** Adapts the app's user-profile hook to the navigation lib's profile shape. */
export const useNavigationUserProfile = (): NavigationUserProfile => {
  const {
    email,
    displayName,
    shortName,
    image,
    isFallbackIconShown,
    setIsFallbackIconShown,
  } = useUserProfile();

  const handleImageError = useCallback(
    () => setIsFallbackIconShown(true),
    [setIsFallbackIconShown],
  );

  return useMemo(
    () => ({
      email,
      displayName,
      shortName,
      imageUrl: image,
      isFallbackShown: isFallbackIconShown,
      onImageError: handleImageError,
    }),
    [
      email,
      displayName,
      shortName,
      image,
      isFallbackIconShown,
      handleImageError,
    ],
  );
};
