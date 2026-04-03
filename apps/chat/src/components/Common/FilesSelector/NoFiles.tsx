import { IconFile } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { FilesI18nKeys } from '@/src/constants/i18n';

interface Props {
  caption?: string;
}

export const NoFiles: React.FC<Props> = ({
  caption = FilesI18nKeys.NoDocumentsAdded,
}) => {
  const { t } = useTranslation(Translation.Files);

  return (
    <div className="flex flex-col items-center justify-center rounded border border-primary py-4">
      <IconFile size={60} stroke={0.5} className="text-secondary" />
      <span className="mt-2 text-sm">{t(caption)}</span>
    </div>
  );
};
