import { IconFolderOpen } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { Routes } from '@/src/constants/routes';

import { NavigationButton } from './NavigationButton';

export const FilesNavigation = () => {
  const { t } = useTranslation(Translation.SideBar);

  const router = useRouter();

  const handleFilesClick = useCallback(() => {
    return router.push(Routes.FilesManager);
  }, [router]);

  return (
    <NavigationButton
      onClick={handleFilesClick}
      tooltip={t('Files')}
      Icon={IconFolderOpen}
      selected={router.route === Routes.FilesManager}
      caption={t('Files')}
    />
  );
};
