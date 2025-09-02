import { useMemo } from 'react';

import { useRouter } from 'next/router';

import { ToolsetCredentialsLevel } from '@/src/types/toolsets';

import { Routes } from '@/src/constants/routes';

export const useToolsetCredentialsLevel = () => {
  const router = useRouter();

  // TODO: update when conditions are clear
  const level = useMemo(() => {
    switch (router.route) {
      case Routes.Chat:
        return ToolsetCredentialsLevel.USER;
      case Routes.AppsEditorSettings:
        return ToolsetCredentialsLevel.APP;
      default:
        return ToolsetCredentialsLevel.GLOBAL;
    }
  }, [router.route]);

  return level;
};
