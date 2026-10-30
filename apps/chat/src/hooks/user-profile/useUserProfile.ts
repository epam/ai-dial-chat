import { useCallback, useMemo, useState } from 'react';
import { useUser } from '../../context/auth/UserContext';

export const useUserProfile = () => {
  const { user } = useUser();

  /* The BFF stores the standard OIDC `picture` claim (avatar URL). */
  const image = user?.claims?.['picture'] as string | undefined;
  /*
   * Track the URL that failed rather than a boolean: the profile loads after
   * the first render, and a new avatar URL must get its own chance to load.
   */
  const [failedImage, setFailedImage] = useState<string>();
  const isFallbackIconShown = !image || failedImage === image;

  const setIsFallbackIconShown = useCallback(
    (isShown: boolean) => setFailedImage(isShown ? image : undefined),
    [image],
  );

  const email = (user?.claims?.['email'] as string) ?? user?.sub ?? '';
  const displayName = (user?.claims?.['name'] as string) || email;

  const shortName = useMemo(() => {
    const nameClaim = (user?.claims?.['name'] as string) || '';
    const [part1, part2] = nameClaim.includes(' ')
      ? nameClaim.split(' ')
      : [nameClaim[0], nameClaim[1]];
    if (part1 && part2) {
      return `${part1[0]}${part2[0]}`;
    }
    return nameClaim;
  }, [user?.claims]);

  return {
    email,
    displayName,
    shortName,
    image,
    isFallbackIconShown,
    setIsFallbackIconShown,
  };
};
