import { useMemo, useState } from 'react';
import { useUser } from '../../context/auth/UserContext';

export const useUserProfile = () => {
  const { user } = useUser();

  const image = user?.claims?.['image'] as string | undefined;
  const [isFallbackIconShown, setIsFallbackIconShown] = useState(!image);

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
