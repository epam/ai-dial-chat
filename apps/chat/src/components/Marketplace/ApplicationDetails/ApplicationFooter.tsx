import { IconDownload, IconPlayerPlay, IconShare } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

interface Props {
  installed: boolean;
  modelType: string;
}

export const ApplicationDetailsFooter = ({ installed, modelType }: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const ApplyIcon = installed ? IconDownload : IconPlayerPlay;

  return (
    <section className="flex p-4 md:px-6">
      <div className="flex w-full items-center justify-between">
        <IconShare
          className="ml-3 text-accent-primary md:hidden [&_path]:fill-current"
          size={18}
        />
        <div className="flex w-full justify-end gap-2">
          <button className="rounded border-[1px] border-primary px-3 py-2 text-sm font-semibold">
            {t('Cancel')}
          </button>
          <button className="flex items-center gap-3 rounded bg-accent-primary px-3 py-2 text-sm font-semibold">
            <ApplyIcon size={18} />
            <span>
              {installed
                ? t('Install {{modelType}}', {
                    modelType,
                  })
                : t('Use application')}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
